// devtools_panel.js

function changeBackgroundColor(color) {
  chrome.scripting.executeScript({
    target: { tabId: chrome.devtools.inspectedWindow.tabId },
    function: function (color) {
      document.body.style.backgroundColor = color;
    },
    args: [color],
  });
}

document.getElementById("red").addEventListener("click", function () {
  changeBackgroundColor("red");
});

document.getElementById("green").addEventListener("click", function () {
  changeBackgroundColor("green");
});

document.getElementById("blue").addEventListener("click", function () {
  changeBackgroundColor("blue");
});
