function loadItems(){

fetch("/api/items")
.then(res => res.json())
.then(data => {

const list = document.getElementById("items");
list.innerHTML = "";

data.forEach(item => {
list.innerHTML += `<p>${item.id}: ${item.name}</p>`;
});

});

}

function addItem(){

const name = document.getElementById("name").value;

fetch("/api/items", {
method:"POST",
headers:{
"Content-Type":"application/json"
},
body: JSON.stringify({name:name})
})
.then(res => res.json())
.then(() => loadItems());

}

function updateItem(){

const id = document.getElementById("updateId").value;
const name = document.getElementById("updateName").value;

fetch("/api/items",{
method:"PUT",
headers:{
"Content-Type":"application/json"
},
body: JSON.stringify({
id:id,
name:name
})
})
.then(res => res.json())
.then(() => loadItems());

}

function deleteItem(){

const id = document.getElementById("deleteId").value;

fetch("/api/items",{
method:"DELETE",
headers:{
"Content-Type":"application/json"
},
body: JSON.stringify({id:id})
})
.then(res => res.json())
.then(() => loadItems());

}
