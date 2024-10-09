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

const joinRoom = (room) => {
    if (currentRoom) {
        socket.emit('leaveRoom', currentRoom);
    }
    currentRoom = room;
    socket.emit('joinRoom', room);
    clearAnswerButtons(); // Clear old buttons when joining a new room
};

// Initiate a call
const call = async (room) => {
    joinRoom(room);
    await fetchUserMedia();
    await createPeerConnection();

    try {
        console.log("Creating offer...");
        const offer = await peerConnection.createOffer();
        console.log(offer);
        await peerConnection.setLocalDescription(offer);
        didIOffer = true;
        socket.emit('newOffer', { offer, room, offererUserName: userName }); // Include the username and room
    } catch (err) {
        console.log(err);
    }
};

// Answering an offer
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
                room: currentRoom, // Include room information
                iceUserName: userName,
                didIOffer,
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

// Update existing socket listeners to handle room logic
socket.on('availableOffers', (offers) => {
    createOfferEls(offers.filter(o => o.room === currentRoom)); // Filter offers by room
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

// Remaining functions...

document.getElementById('hangup').addEventListener('click', hangUp);
document.querySelector("#answer").addEventListener('click', function () {
    this.remove();
});
