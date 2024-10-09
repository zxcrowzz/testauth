// Listen for available offers
socket.on('availableOffers', (offers) => {
    console.log('Available Offers:', offers);
    createOfferEls(offers);
});

// Listen for a new offer
socket.on('newOfferAwaiting', (offers) => {
    createOfferEls(offers);
});

// Listen for the answer response
socket.on('answerResponse', (offerObj) => {
    console.log('Answer Response:', offerObj);
    addAnswer(offerObj);
});

// Listen for received ICE candidates
socket.on('receivedIceCandidateFromServer', (iceCandidate) => {
    addNewIceCandidate(iceCandidate);
    console.log('Received ICE Candidate:', iceCandidate);
});

// Create offer elements and display answer buttons
function createOfferEls(offers) {
    const answerContainer = document.querySelector('#answer');
    clearAnswerButtons(); // Clear existing buttons before adding new ones

    offers.forEach(o => {
        console.log('Creating offer element:', o);
        const newOfferEl = document.createElement('div');
        newOfferEl.innerHTML = `<button class="btn btn-success">Answer ${o.offererUserName}</button>`;
        
        // Event listener for the answer button
        newOfferEl.querySelector('button').addEventListener('click', () => answerOffer(o));
        answerContainer.appendChild(newOfferEl);
    });
}

// Function to clear existing answer buttons
function clearAnswerButtons() {
    const answerContainer = document.querySelector('#answer');
    while (answerContainer.firstChild) {
        answerContainer.removeChild(answerContainer.firstChild);
    }
}

// Incoming call handler
socket.on('incomingCall', (offerObj) => {
    console.log('Incoming Call:', offerObj);
    const answerButton = document.createElement('button');
    answerButton.textContent = 'Answer Call';
    answerButton.id = 'answer';
    answerButton.classList.add('btn', 'btn-success');

    // Event listener for the incoming call answer button
    answerButton.onclick = () => {
        answerOffer(offerObj);
        answerButton.remove(); // Remove the button after answering
    };

    document.getElementById('container').appendChild(answerButton);
});

// Example usage of the hang-up button
const callButton = document.querySelector('#hangup'); // Make sure the ID matches
callButton.disabled = true; // Disable the hang-up button initially

// Event listener for hang-up button
callButton.addEventListener('click', hangUp);
