const userName = "Pantsbro"+Math.floor(Math.random() * 100000)
const password = "x";
let hasAnsweredCall = false;
let currentRoom = null; 
document.querySelector('#user-name').innerHTML = userName;
let isInCall = false; 
//if trying it on a phone, use this instead...
 const socket = io.connect('https://r3dxx-9ce6f110c87b.herokuapp.com',{
//const socket = io.connect('https://localhost:8181/',{
    auth: {
        userName,password
    }
})
const messageDiv = document.getElementById('container1');
const localVideoEl = document.querySelector('#local-video');
const remoteVideoEl = document.querySelector('#remote-video');

let localStream; //a var to hold the local video stream
let remoteStream; //a var to hold the remote video stream
let peerConnection; //the peerConnection that the two clients use to talk
let didIOffer = false;

let peerConfiguration = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
            ]
        },
        {
            urls: 'turn:relay1.expressturn.com:3478', 
            username: 'ef0645F7PFI1NDP4KH',                 
            credential: 'BNeVubliu1aMKEpN'                 
        }
    ]
};



//when a client initiates a call
const call = async (e) => {
    try {
        await fetchUserMedia();
        await createPeerConnection();

        console.log("Creating offer...");
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        didIOffer = true;
        socket.emit('newOffer', { offer, room: currentRoom }); // Send offer to specific room
    } catch (err) {
        console.error('Error during call setup:', err);
    }
};

const answerOffer = async (offerObj) => {
    try {
        hasAnsweredCall = true;
        isInCall = true;
        await fetchUserMedia();
        await createPeerConnection(offerObj);

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        offerObj.answer = answer; // Add the answer to the offer object
        const offerIceCandidates = await socket.emitWithAck('newAnswer', { answer, room: currentRoom });
        offerIceCandidates.forEach(c => {
            peerConnection.addIceCandidate(c);
        });
    } catch (err) {
        console.error('Error answering offer:', err);
    }
};
const addAnswer = async (offerObj) => {
    try {
        await peerConnection.setRemoteDescription(offerObj.answer);
        const answerButton = document.getElementById('answer');
        if (answerButton) {
            answerButton.remove();
        }
    } catch (err) {
        console.error('Error setting remote description:', err);
    }
};
const fetchUserMedia = ()=>{
    return new Promise(async(resolve, reject)=>{
        try{
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            localVideoEl.srcObject = stream;
            localVideoEl.muted = true
            localStream = stream;    
            resolve();    
        }catch(err){
            console.log(err);
            reject()
        }
    })
}

const createPeerConnection = (offerObj)=>{
    return new Promise(async(resolve, reject)=>{
        //RTCPeerConnection is the thing that creates the connection
        //we can pass a config object, and that config object can contain stun servers
        //which will fetch us ICE candidates
        peerConnection = await new RTCPeerConnection(peerConfiguration)
        remoteStream = new MediaStream()
        remoteVideoEl.srcObject = remoteStream;


        localStream.getTracks().forEach(track=>{
            //add localtracks so that they can be sent once the connection is established
            peerConnection.addTrack(track,localStream);
        })

        peerConnection.addEventListener("signalingstatechange", (event) => {
            console.log(event);
            console.log(peerConnection.signalingState)
        });

        peerConnection.addEventListener('icecandidate',e=>{
            console.log('........Ice candidate found!......')
            console.log(e)
            if(e.candidate){
                socket.emit('sendIceCandidateToSignalingServer',{
                    iceCandidate: e.candidate,
                    iceUserName: userName,
                    didIOffer,
                })    
            }
        })
        
        peerConnection.addEventListener('track',e=>{
            console.log("Got a track from the other peer!! How excting")
            console.log(e)
            e.streams[0].getTracks().forEach(track=>{
                remoteStream.addTrack(track,remoteStream);
                console.log("Here's an exciting moment... fingers cross")
            })
        })

        if(offerObj){
            //this won't be set when called from call();
            //will be set when we call from answerOffer()
            // console.log(peerConnection.signalingState) //should be stable because no setDesc has been run yet
            await peerConnection.setRemoteDescription(offerObj.offer)
            // console.log(peerConnection.signalingState) //should be have-remote-offer, because client2 has setRemoteDesc on the offer
        }
        resolve();
    })
}


const resetClientState = () => {
    // Stop local stream tracks
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connection if it exists
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null; // Clear reference
    }
    
    // Clear video elements
    localVideoEl.srcObject = null;
    remoteVideoEl.srcObject = null;

    isInCall = false; // Reset call state
    console.log('Client state reset');
};

const addNewIceCandidate = iceCandidate=>{
    peerConnection.addIceCandidate(iceCandidate)
    console.log("======Added Ice Candidate======")
}



function appendMessage(message) {
 const messageDiv = document.createElement('div');
 messageDiv.textContent = message;
 container.appendChild(messageDiv);
}

// Function to handle the hang-up action
function hangUp() {
    if (!isInCall) {
        console.log('No active call to hang up from.');
        return;
    }
    
    // Call the reset function
    resetClientState();
    
    // Emit hang-up event to the signaling server
    socket.emit('hangUp');
}
socket.on('chatmessage' , data => {

 console.log(data)

 appendMessage(data)
});
// Listen for the hang-up event from the signaling server
socket.on('hangUp', () => {
    if (remoteVideoEl.srcObject) {
        remoteVideoEl.srcObject.getTracks().forEach(track => track.stop());
    }
    remoteVideoEl.srcObject = null; // Clear remote video
    console.log('Remote user hung up');
});



socket.on('disconnect', () => {
    resetClientState()
    console.log('You have been disconnected');
    
    // Clear local and remote streams
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    localVideoEl.srcObject = null; // Clear local video
    remoteVideoEl.srcObject = null; // Clear remote video

    // Optionally show a notification or update the UI to reflect the disconnection
});

// Add event listener to the hang-up button
// Example usage for joining a room when a button is clicked
document.getElementById('join-button').addEventListener('click', () => {
    const roomId = document.getElementById('room-input').value.trim();
    if (roomId) {
        joinRoom(roomId);
    } else {
        alert('Please enter a room ID.');
    }
});



document.getElementById('hangup').addEventListener('click', hangUp);




function initiateCall(user) {
    console.log(`Calling ${user.name}`);
    // Implement your logic to initiate a call to the selected user here.
    call(); // Assuming this starts the call process
}

function joinRoom(room) {
    if (currentRoom) {
        socket.emit('leaveRoom', currentRoom); // Leave previous room if exists
    }
    currentRoom = room;
    socket.emit('joinRoom', room);

    
}
// Listen for both users in the room
    socket.on('bothUsersInRoom', () => {
        console.log('Both users are in the room, initiating call...');
        if (!isInCall) {
            call(); // Initiate the call
        }
    });
document.querySelector("#answer").addEventListener('click', function () {

    this.remove()
})
