const userName = "Pantsbro"+Math.floor(Math.random() * 100000)
const password = "x";
let hasAnsweredCall = false;
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
let currentRoom = null;
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
const call = async e=>{
    joinRoom(room);
    await fetchUserMedia();

    //peerConnection is all set with our STUN servers sent over
    await createPeerConnection();

    //create offer time!
    try{
        console.log("Creating offer...")
        const offer = await peerConnection.createOffer();
        console.log(offer);
        peerConnection.setLocalDescription(offer);
        didIOffer = true;
        socket.emit('newOffer',{ offer, room }); //send offer to signalingServer
    }catch(err){
        console.log(err)
    }

}


const joinRoom = (room) => {
    if (currentRoom) {
        // Leave the current room if already in one
        socket.emit('leaveRoom', currentRoom);
    }
    currentRoom = room;
    socket.emit('joinRoom', room);
};
const answerOffer = async(offerObj)=>{
    hasAnsweredCall = true;
    isInCall = true
    await fetchUserMedia()
    await createPeerConnection(offerObj);
    const answer = await peerConnection.createAnswer({}); //just to make the docs happy
    await peerConnection.setLocalDescription(answer); //this is CLIENT2, and CLIENT2 uses the answer as the localDesc
    console.log(offerObj)
    console.log(answer)
    // console.log(peerConnection.signalingState) //should be have-local-pranswer because CLIENT2 has set its local desc to it's answer (but it won't be)
    //add the answer to the offerObj so the server knows which offer this is related to
    offerObj.answer = answer 
    //emit the answer to the signaling server, so it can emit to CLIENT1
    //expect a response from the server with the already existing ICE candidates
    const offerIceCandidates = await socket.emitWithAck('newAnswer',offerObj)
    offerIceCandidates.forEach(c=>{
        peerConnection.addIceCandidate(c);
        console.log("======Added Ice Candidate======")
    })
    console.log(offerIceCandidates)
}

const addAnswer = async(offerObj)=>{
    //addAnswer is called in socketListeners when an answerResponse is emitted.
    //at this point, the offer and answer have been exchanged!
    //now CLIENT1 needs to set the remote
    await peerConnection.setRemoteDescription(offerObj.answer)
    const answerzz = document.querySelector('#answer');
    if (answerzz) {
        answerzz.remove(); // Remove it if you want to prevent future calls
    }
}

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

const userSearchInput = document.getElementById('user-search');
const userList = document.getElementById('user-list');

userSearchInput.addEventListener('input', async (event) => {
    const searchTerm = event.target.value;

    if (searchTerm.length > 2) { // Trigger search after typing 3 characters
        const response = await fetch(`/search?name=${searchTerm}`);
        const users = await response.json();
        
        // Clear previous results
        userList.innerHTML = '';

        users.forEach(user => {
            const li = document.createElement('li');
            li.textContent = user.name;
            li.classList.add('list-group-item');
            li.onclick = () => initiateCall(user); // Call the user when their name is clicked
            userList.appendChild(li);
        });
    } else {
        // Clear the user list if search term is too short
        userList.innerHTML = '';
    }
});

function initiateCall(user) {
    console.log(`Calling ${user.name}`);
    // Implement your logic to initiate a call to the selected user here.
    call(); // Assuming this starts the call process
}



document.getElementById('hangup').addEventListener('click', hangUp);





document.querySelector("#answer").addEventListener('click', function () {

    this.remove()
})
