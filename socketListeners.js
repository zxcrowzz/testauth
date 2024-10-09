
socket.on('availableOffers',offers=>{
    console.log(offers)
    createOfferEls(offers)
})

//someone just made a new offer and we're already here - call createOfferEls
socket.on('newOfferAwaiting',offers=>{
    createOfferEls(offers)
})

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
const callButton = document.querySelector('#Hangup'); // Select the button by its ID
callButton.disabled = true;

function clearAnswerButtons() {
    const answerEl = document.querySelector('#answer');
    while (answerEl.firstChild) {
        answerEl.removeChild(answerEl.firstChild);
    }
}

document.addEventListener('DOMContentLoaded', clearAnswerButtons);


// In socketListeners.js
socket.on('incomingCall', (offerObj) => {
    const answerButton = document.createElement('button');
    answerButton.textContent = 'Answer Call';
    answerButton.id = 'answer';
    answerButton.classList.add('btn', 'btn-success');
    answerButton.onclick = () => answerOffer(offerObj);
    document.getElementById('container').appendChild(answerButton);
});
