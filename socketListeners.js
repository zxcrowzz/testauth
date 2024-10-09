
//on connection get all available offers and call createOfferEls
socket.on('availableOffers', offers => {
    if (Array.isArray(offers)) {
        console.log(offers);
        createOfferEls(offers);
    } else {
        console.error('Expected offers to be an array, but got:', typeof offers);
    }
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

function createOfferEls(offers){
    //make green answer button for this new offer
    const answerEl = document.querySelector('#answer');
    offers.forEach(o=>{
        console.log(o);
        const newOfferEl = document.createElement('div');
        newOfferEl.innerHTML = `<button class="btn btn-success col-1">Answer ${o.offererUserName}</button>`
        newOfferEl.addEventListener('click',()=>answerOffer(o))
        answerEl.appendChild(newOfferEl);
    })
}


function clearAnswerButtons() {
    const answerEl = document.querySelector('#answer');
    while (answerEl.firstChild) {
        answerEl.removeChild(answerEl.firstChild);
    }
}

document.addEventListener('DOMContentLoaded', clearAnswerButtons);
