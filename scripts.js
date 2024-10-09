const userName = "Pantsbro" + Math.floor(Math.random() * 100000);
const password = "x";
let hasAnsweredCall = false;
document.querySelector('#user-name').innerHTML = userName;
let isInCall = false;
const socket = io.connect('https://r3dxx-9ce6f110c87b.herokuapp.com', {
    auth: {
        userName,
        password
    }
});

const messageDiv = document.getElementById('container1');
const localVideoEl = document.querySelector('#local-video');
const remoteVideoEl = document.querySelector('#remote-video');
let currentRoom = null;
let localStream;
let remoteStream;
let peerConnection;
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

// When a client initiates a call
const call = async (room) => {
    joinRoom(room);
    await fetchUserMedia();
    await createPeerConnection();

    // Create offer time!
    try {
        console.log("Creating offer...");
        const offer = await peerConnection.createOffer();
        console.log(offer);
        await peerConnection.setLocalDescription(offer);
        didIOffer = true;
        socket.emit('newOffer', { offer, room, offererUserName: userName }); // Send offer to signaling server
    } catch (err) {
        console.log(err);
    }
};

const joinRoom = (room) => {
    if (currentRoom) {
        socket.emit('leaveRoom', currentRoom);
    }
    currentRoom = room;
    socket.emit('joinRoom', room);
    clearAnswerButtons(); // Clear old buttons when joining a new room
};

const answerOffer = async (offerObj) => {
    hasAnsweredCall = true;
    isInCall = true;
    await fetchUserMedia();
    await createPeerConnection(offerObj);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    offerObj.answer = answer;
    socket.emit('newAnswer', offerObj); // Send answer back with room context
};

const addAnswer = async (offerObj) => {
    await peerConnection.setRemoteDescription(offerObj.answer);
    const answerzz = document.querySelector('#answer');
    if (answerzz) {
        answerzz.remove(); // Remove it if you want to prevent future calls
    }
};

const fetchUserMedia = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            localVideoEl.srcObject = stream;
            localVideoEl.muted = true;
            localStream = stream;
            resolve();
        } catch (err) {
            console.log(err);
            reject();
        }
    });
};

const createPeerConnection = async (offerObj) => {
    peerConnection = new RTCPeerConnection(peerConfiguration);
    remoteStream = new MediaStream();
    remoteVideoEl.srcObject = remoteStream;

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.addEventListener('icecandidate', e => {
        if (e.candidate) {
            socket.emit('sendIceCandidateToSignalingServer', {
                iceCandidate: e.candidate,
                iceUserName: userName,
                didIOffer,
                room: currentRoom // Include room context
            });
        }
    });

    peerConnection.addEventListener('track', e => {
        e.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
        });
    });

    if (offerObj) {
        await peerConnection.setRemoteDescription(offerObj.offer);
    }
};

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

const addNewIceCandidate = iceCandidate => {
    peerConnection.addIceCandidate(iceCandidate);
    console.log("======Added Ice Candidate======");
};

function appendMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    container.appendChild(messageDiv);
}

function hangUp() {
    if (!isInCall) {
        console.log('No active call to hang up from.');
        return;
    }

    resetClientState();
    socket.emit('hangUp');
}

socket.on('chatmessage', data => {
    console.log(data);
    appendMessage(data);
});

socket.on('hangUp', () => {
    if (remoteVideoEl.srcObject) {
        remoteVideoEl.srcObject.getTracks().forEach(track => track.stop());
    }
    remoteVideoEl.srcObject = null;
    console.log('Remote user hung up');
});

socket.on('disconnect', () => {
    resetClientState();
    console.log('You have been disconnected');
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    localVideoEl.srcObject = null;
    remoteVideoEl.srcObject = null;
});

const userSearchInput = document.getElementById('user-search');
const userList = document.getElementById('user-list');

userSearchInput.addEventListener('input', async (event) => {
    const searchTerm = event.target.value;

    if (searchTerm.length > 2) {
        const response = await fetch(`/search?name=${searchTerm}`);
        const users = await response.json();

        userList.innerHTML = '';

        users.forEach(user => {
            const li = document.createElement('li');
            li.textContent = user.name;
            li.classList.add('list-group-item');
            li.onclick = () => initiateCall(user);
            userList.appendChild(li);
        });
    } else {
        userList.innerHTML = '';
    }
});

function initiateCall(user) {
    console.log(`Calling ${user.name}`);
    // You might want to define the room based on user selection or other logic
    const room = user.room; // Example: assuming the user object contains room info
    call(room); // Start the call process
}

document.getElementById('hangup').addEventListener('click', hangUp);

document.querySelector("#answer").addEventListener('click', function () {
    this.remove();
});

// Socket listeners for handling offers and answers in the room context
socket.on('availableOffers', (offers) => {
    createOfferEls(offers.filter(o => o.room === currentRoom));
});

socket.on('newOfferAwaiting', (offers) => {
    createOfferEls(offers.filter(o => o.room === currentRoom));
});

socket.on('answerResponse', (offerObj) => {
    if (offerObj.room === currentRoom) {
        addAnswer(offerObj);
    }
});

function createOfferEls(offers) {
    clearAnswerButtons();
    const answerEl = document.querySelector('#answer');
    offers.forEach(o => {
        const newOfferEl = document.createElement('div');
        newOfferEl.innerHTML = `<button class="btn btn-success col-1">Answer ${o.offererUserName}</button>`;
        newOfferEl.addEventListener('click', () => answerOffer(o));
        answerEl.appendChild(newOfferEl);
    });
}

function clearAnswerButtons() {
    const answerEl = document.querySelector('#answer');
    while (answerEl.firstChild) {
        answerEl.removeChild(answerEl.firstChild);
    }
}
