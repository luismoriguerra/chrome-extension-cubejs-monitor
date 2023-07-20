// devtools.js

var hashMap = {};

chrome.devtools.panels.create(
  "Cube query Monitor",
  "icon16.png",
  "panel.html",
  function (panel) {
    panel.onShown.addListener(function (win) {
      var table = win.document.getElementById("requests-table");
      var tbody = table.querySelector("tbody");
      var totalCount = win.document.getElementById("total-count");
      var clearTableBtn = win.document.getElementById("clear-table");
      var filterInput = win.document.getElementById("filter-input");

      // Clear the hashMap and the table when the panel is shown
      hashMap = {};
      tbody.innerHTML = "";

      function updateTable() {
        // Clear the existing table
        tbody.innerHTML = "";
        // Get the filter string from the input field
        var filterStr = filterInput.value.toLowerCase();

        // Populate the table with hashMap values
        for (var key in hashMap) {
          if (hashMap.hasOwnProperty(key)) {
            // Convert the hashMap value into a string for easy searching
            var valueStr = JSON.stringify(hashMap[key]).toLowerCase();
            if (
              key.toLowerCase().includes(filterStr) ||
              valueStr.includes(filterStr)
            ) {
              var row = win.document.createElement("tr");
              var totalTimeInSeconds = (hashMap[key].totalTime * 1000).toFixed(
                2
              ); // Convert to seconds
              row.innerHTML = `<td>${key}</td><td>${hashMap[key].count}</td><td>${totalTimeInSeconds}</td><td>${hashMap[key].response}</td><td>${hashMap[key].error}</td>`;
              tbody.appendChild(row);
            }
          }
        }

        // Update total count
        totalCount.textContent =
          "Total queries: " + Object.keys(hashMap).length;
      }

      clearTableBtn.addEventListener("click", function () {
        hashMap = {}; // Clear the hashMap
        updateTable(); // Clear the table
        // tbody.innerHTML = ""; // Clear the table
        // totalCount.textContent = "Total queries: 0"; // Reset the total count
      });

      filterInput.addEventListener("input", updateTable);

      chrome.devtools.network.onRequestFinished.addListener(function (request) {
        if (request.request.method !== "GET") {
          return;
        }
        var url = new URL(request.request.url);
        var params = new URLSearchParams(url.search);
        var query = params.get("query");
        if (query !== null) {
          query = decodeURIComponent(query);
          if (hashMap[query]) {
            hashMap[query].count++;
            hashMap[query].totalTime += request.time;
            hashMap[query].requests.push(request);
            hashMap[query].methods.push(request.request.method);
          } else {
            hashMap[query] = {
              methods: [request.request.method],
              count: 1,
              totalTime: request.time,
              requests: [request],
              errors: [],
              response: [],
            };
          }
        }

        request.getContent(function (body) {
          let response;
          try {
            response = JSON.parse(body);
          } catch (e) {
            response = body;
          }

          // hashMap[query].response.push(response.results);
          let result = response.results;
          let error = response.error;
          hashMap[query].response.push(result);
          hashMap[query].errors.push(error);
          // Clear the existing table
          tbody.innerHTML = "";
          // Populate the table with hashMap values
          for (var key in hashMap) {
            if (hashMap.hasOwnProperty(key)) {
              var row = win.document.createElement("tr");
              var totalTimeInSeconds = (hashMap[key].totalTime / 1000).toFixed(
                2
              );
              row.innerHTML = `
            <td>
            <details>
                <summary> ${key}</summary>
                <pre style="font-size:16px">
                ${JSON.stringify(JSON.parse(key), null, 2)}
                </pre>
              </details>
           
            </td>
            <td>${hashMap[key].count}</td>
            <td>${totalTimeInSeconds}</td>
            <td>${hashMap[key].methods.join(", ")}</td>
            <td>${JSON.stringify(hashMap[key].errors)}</td>
            <td>
                <details>
                    <summary>Requests</summary>
                    <div>
                    ${JSON.stringify(hashMap[key].response)}
                    </div>
                </details>
            </td>
            `;
              tbody.appendChild(row);
            }
          }
          // Update total count
          totalCount.textContent =
            "Total queries: " + Object.keys(hashMap).length;
        });
      });
    });
  }
);
