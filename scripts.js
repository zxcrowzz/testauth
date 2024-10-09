const userName = "Pantsbro" + Math.floor(Math.random() * 100000);
const password = "x";
let hasAnsweredCall = false;
let currentRoom = null; 
document.querySelector('#user-name').innerHTML = userName;

// Connect to the socket
const socket = io.connect('https://r3dxx-9ce6f110c87b.herokuapp.com', {
    auth: {
        userName, 
        password
    }
});

const messageDiv = document.getElementById('container1');
let localStream;
let remoteStream;
let peerConnection;
let iceCandidateQueue = [];

let isInCall = false;
let didIOffer = false;

const localVideoEl = document.getElementById('local-video');
const remoteVideoEl = document.getElementById('remote-video');

const fetchUserMedia = async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideoEl.srcObject = localStream;
        localVideoEl.muted = true;
    } catch (error) {
        console.error('Error accessing media devices.', error);
    }
};

const createPeerConnection = async (offerObj) => {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: 'turn:your-turn-server-url', // Replace with your TURN server URL
                username: 'your-username', // Replace with your TURN username
                credential: 'your-credential' // Replace with your TURN password
            }
        ]
    };

    // Create the RTCPeerConnection
    peerConnection = new RTCPeerConnection(configuration);

    // Check if localStream is defined before adding tracks
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    } else {
        console.error('Local stream is not available. Cannot add tracks to peer connection.');
    }

    // Set up remote stream
    remoteStream = new MediaStream();
    remoteVideoEl.srcObject = remoteStream;

    // Event listeners for ICE candidates and remote tracks
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('sendIceCandidateToSignalingServer', {
                iceCandidate: event.candidate,
                iceUserName: userName,
                didIOffer
            });
        }
    };

    peerConnection.ontrack = event => {
        remoteStream.addTrack(event.track);
    };

    // Set remote description if an offer object is provided
    if (offerObj) {
        await peerConnection.setRemoteDescription(offerObj.offer);
    }

    // Process buffered ICE candidates if any
    iceCandidateQueue.forEach(candidate => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(error => console.error('Error adding buffered ICE candidate', error));
    });
    iceCandidateQueue = []; // Clear the queue
};


const call = async () => {
    try {
        await fetchUserMedia();
        await createPeerConnection(null); // Pass null to indicate no offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        didIOffer = true;

        socket.emit('newOffer', { 
            offer, 
            room: currentRoom, 
            offererUserName: userName 
        });
    } catch (error) {
        console.error('Error during call setup:', error);
    }
};


async function answerOffer(offerObj) {
    console.log('Answering offer from:', offerObj.offererUserName);
    
    // Create the peer connection
    await createPeerConnection(offerObj);

    // Set the remote description using the offer
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offerObj.offer));

    // Now create the answer
    const answer = await peerConnection.createAnswer();

    // Set the local description with the created answer
    await peerConnection.setLocalDescription(answer);

    // Emit the answer back to the signaling server
    socket.emit('newAnswer', {
        answer,
        room: currentRoom,
        offererUserName: offerObj.offererUserName
    });
}



function joinRoom(room) {
    if (currentRoom) {
        socket.emit('leaveRoom', currentRoom);
    }

    currentRoom = room;
    socket.emit('joinRoom', room);

    socket.on('bothUsersInRoom', () => {
        if (!isInCall) {
            console.log('Both users are in the room, initiating call...');
            call();
        }
    });

    socket.on('offerReceived', offer => {
        answerOffer(offer);
    });
}

// Handle ICE candidates from the signaling server
socket.on('receivedIceCandidateFromServer', iceCandidate => {
    if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate))
            .catch(error => console.error('Error adding received ICE candidate', error));
    } else {
        console.warn('Received ICE candidate but peer connection is undefined. Buffering the candidate.');
        iceCandidateQueue.push(iceCandidate); // Buffering candidates if peerConnection is not yet initialized
    }
});

// Hang-up function
function hangUp() {
    if (!isInCall) {
        console.log('No active call to hang up from.');
        return;
    }
    resetClientState();
    socket.emit('hangUp');
}

// Reset client state
const resetClientState = () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    localVideoEl.srcObject = null;
    remoteVideoEl.srcObject = null;
    isInCall = false;
    console.log('Client state reset');
};
async function initiateCall() {
    console.log('Call initiated');
    await call(); // Assuming call() is defined in your code
}
// Event listeners
document.getElementById('join-button').addEventListener('click', () => {
    const roomId = document.getElementById('room-input').value.trim();
    if (roomId) {
        joinRoom(roomId);
    } else {
        alert('Please enter a room ID.');
    }
});

document.getElementById('hangup').addEventListener('click', hangUp);
