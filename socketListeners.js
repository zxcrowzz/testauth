const usersInRoom = [];
// Function to verify if a user is in the room
function verifyUserInRoom(userId) {
    return usersInRoom.some(user => user.id === userId);
}
//on connection get all available offers and call createOfferEls
socket.on('availableOffers', offers => {
    if (Array.isArray(offers)) {
        console.log(offers);
        createOfferEls(offers);
    } else {
        console.error('Expected offers to be an array, but got:', typeof offers);
    }
});
socket.on('bothUsersInRoom' , roomName => {


 const currentUserId = socket.id; // Get the current user's socket ID

    // Check if the user is already in the usersInRoom array
    if (!usersInRoom.includes(currentUserId)) {
        usersInRoom.push(currentUserId); // Add the current user to the array
        console.log(`User ${currentUserId} added to usersInRoom for ${roomName}`);
    }

    // Log the current users in the room
    console.log('Current users in the room:', usersInRoom);


});
//someone just made a new offer and we're already here - call createOfferEls
socket.on('newOfferAwaiting', offers => {
    if (Array.isArray(offers)) {
        createOfferEls(offers);
    } else {
        console.error('Expected offers to be an array, but got:', typeof offers);
    }
});
socket.on('answerResponse',offerObj=>{
    console.log(offerObj)
    addAnswer(offerObj)
})

socket.on('receivedIceCandidateFromServer',iceCandidate=>{
    addNewIceCandidate(iceCandidate)
    console.log(iceCandidate)
})


function createOfferEls(offers) {
    if (!Array.isArray(offers)) {
        console.error('Expected offers to be an array, but got:', typeof offers);
        return;
    }

    const answerEl = document.querySelector('#answer');
    clearAnswerButtons(); // Clear existing buttons before adding new ones

    offers.forEach(o => {
        console.log(o);
        const newOfferEl = document.createElement('div');
        newOfferEl.innerHTML = `<button class="btn btn-success col-1">Answer ${o.offererUserName}</button>`;
        newOfferEl.addEventListener('click', () => {
            if (verifyUserInRoom(o.offererUserId)) {
                answerOffer(o);
            } else {
                console.error('User not in the room or unauthorized access');
            }
        });
        answerEl.appendChild(newOfferEl);
   });
}





function clearAnswerButtons() {
    const answerEl = document.querySelector('#answer');
    while (answerEl.firstChild) {
        answerEl.removeChild(answerEl.firstChild);
    }
}

document.addEventListener('DOMContentLoaded', clearAnswerButtons);
