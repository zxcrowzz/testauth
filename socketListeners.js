
//on connection get all available offers and call createOfferEls
let currentRoom = null;

// When connected, get all available offers for the current room
socket.on('availableOffers', (offers) => {
    console.log(offers);
    if (currentRoom) {
        createOfferEls(offers.filter(o => o.room === currentRoom));
    }
});

// Someone just made a new offer and we're already in the room
socket.on('newOfferAwaiting', (offers) => {
    if (currentRoom) {
        createOfferEls(offers.filter(o => o.room === currentRoom));
    }
});

// Listen for answer responses
socket.on('answerResponse', (offerObj) => {
    if (offerObj.room === currentRoom) {
        console.log(offerObj);
        addAnswer(offerObj);
    }
});

// Listen for ICE candidates from the server
socket.on('receivedIceCandidateFromServer', (iceCandidate) => {
    addNewIceCandidate(iceCandidate);
    console.log(iceCandidate);
});

// Create offer elements for the available offers
function createOfferEls(offers) {
    clearAnswerButtons(); // Clear old buttons before adding new ones
    const answerEl = document.querySelector('#answer');
    
    offers.forEach(o => {
        console.log(o);
        const newOfferEl = document.createElement('div');
        newOfferEl.innerHTML = `<button class="btn btn-success col-1">Answer ${o.offererUserName}</button>`;
        newOfferEl.addEventListener('click', () => answerOffer(o));
        answerEl.appendChild(newOfferEl);
    });
}
const callButton = document.querySelector('#Hangup'); // Select the button by its ID
callButton.disabled = true;

function clearAnswerButtons() {
    const answerEl = document.querySelector('#answer');
    while (answerEl.firstChild) {
        answerEl.removeChild(answerEl.firstChild);
    }
}

document.addEventListener('DOMContentLoaded', clearAnswerButtons);
