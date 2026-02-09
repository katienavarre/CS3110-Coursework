document.getElementById("deleteButton").addEventListener("click", function() {
    let intro = document.getElementById("introText");

    intro.remove();
} );

document.getElementById("addBtn").addEventListener("click", function() {
    let newParagraph = document.createElement("p");
    newParagraph.textContent = "This is a new paragraph added to the page.";

    document.getElementById("messageArea").appendChild(newParagraph);
} );

document.getElementById("messageForm").addEventListener("submit", function(event) {
    event.preventDefault(); 

    /*
    preventDefault() is used to stop the form from submitting and refreshing the page. This 
    allows us to handle the form submission with JavaScript and update the page dynamically 
    without losing any current content.
    */

    let input = document.getElementById("userInput");
    input.setAttribute("placeholder", "Message Submitted: ");

    input.value = ""; 
} );