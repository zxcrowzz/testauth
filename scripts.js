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
    peerConnection = new RTCPeerConnection();

    // Add local stream tracks to peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

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

    if (offerObj) {
        await peerConnection.setRemoteDescription(offerObj.offer);
    }
};

const call = async () => {
    try {
        await fetchUserMedia();
        await createPeerConnection();

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        didIOffer = true;

        // Emit the new offer with the offererUserName
        socket.emit('newOffer', { 
            offer, 
            room: currentRoom, 
            offererUserName: userName // Add this line
        });
    } catch (error) {
        console.error('Error during call setup:', error);
    }
};

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
    peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate))
        .catch(error => console.error('Error adding received ICE candidate', error));
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
