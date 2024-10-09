// Listen for available offers
socket.on('availableOffers', (offers) => {
    console.log('Available Offers:', offers);
    createOfferElements(offers);
});

// Listen for a new offer
socket.on('newOfferAwaiting', (offers) => {
    createOfferElements(offers);
});

// Listen for the answer response
socket.on('answerResponse', (offerObj) => {
    console.log('Answer Response:', offerObj);
    handleAnswer(offerObj);
});

// Listen for received ICE candidates
socket.on('receivedIceCandidateFromServer', (iceCandidate) => {
    addIceCandidate(iceCandidate);
    console.log('Received ICE Candidate:', iceCandidate);
});

// Listen for when both users are in the room
socket.on('bothUsersInRoom', () => {
    console.log('Both users are in the room, initiating call...');
    if (!isInCall) {
        initiateCall(); // Start the call
    }
});

// Incoming call handler
socket.on('incomingCall', (offerObj) => {
    console.log('Incoming Call:', offerObj);
    const answerButton = document.createElement('button');
    answerButton.textContent = 'Answer Call';
    answerButton.classList.add('btn', 'btn-success');

    // Event listener for the incoming call answer button
    answerButton.onclick = () => {
        respondToOffer(offerObj);
        answerButton.remove(); // Remove the button after answering
    };

    document.getElementById('container').appendChild(answerButton);
});

// Create offer elements and display answer buttons
function createOfferElements(offers) {
    const answerContainer = document.querySelector('#answer');
    clearExistingButtons(); // Clear existing buttons before adding new ones

    offers.forEach(o => {
        console.log('Creating offer element:', o);
        const newOfferElement = document.createElement('div');
        newOfferElement.innerHTML = `<button class="btn btn-success">Answer ${o.offererUserName}</button>`;
        
        // Event listener for the answer button
        newOfferElement.querySelector('button').addEventListener('click', () => respondToOffer(o));
        answerContainer.appendChild(newOfferElement);
    });
}

// Function to clear existing answer buttons
function clearExistingButtons() {
    const answerContainer = document.querySelector('#answer');
    while (answerContainer.firstChild) {
        answerContainer.removeChild(answerContainer.firstChild);
    }
}

// Handle answering an offer
async function respondToOffer(offerObj) {
    console.log('Answering offer from:', offerObj.offererUserName);
    // Logic to set up peer connection and respond to the offer
    await setupPeerConnection(offerObj);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('newAnswer', {
        answer,
        room: currentRoom,
        offererUserName: offerObj.offererUserName // Ensure this is included
    });
}

// Add new ICE candidate
function addIceCandidate(iceCandidate) {
    if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate))
            .catch(error => console.error('Error adding received ICE candidate', error));
    }
}

// Handle answer response
function handleAnswer(offerObj) {
    console.log('Handling answer response:', offerObj);
    // Implement any necessary logic here, such as updating the UI
}

// Example usage of the hang-up button
const hangUpButton = document.querySelector('#hangup'); // Ensure the ID matches
hangUpButton.disabled = true; // Disable the hang-up button initially

// Event listener for hang-up button
hangUpButton.addEventListener('click', hangUp);
