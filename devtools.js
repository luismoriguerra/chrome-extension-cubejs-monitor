
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
      // hashMap = {};
      // tbody.innerHTML = "";

      function generateRowHTML(key, hashMap) {
        var totalTimeInSeconds = (hashMap[key].totalTime / 1000).toFixed(2);
        return `
          <td>${hashMap[key].status}</td>
          <td>${JSON.stringify(hashMap[key].errors)}</td>
          <td>${hashMap[key].count}</td>
          <td>${totalTimeInSeconds}</td>
          <td>${JSON.stringify(hashMap[key].dataSource)}</td>
          <td>${JSON.stringify(hashMap[key].extras)}</td>
          <td>
            ${hashMap[key].playurls.map((url) => {
              return `<a href="${url}" target="_blank">play</a>`;
            })}
            <hr />
            <details>
              <summary> ${key}</summary>
              <pre style="font-size:14px">
                ${JSON.stringify(JSON.parse(key), null, 2)}
              </pre>
            </details>
            <details>
              <summary>responses</summary>
              <pre style="font-size:12px">
                ${JSON.stringify({ responses: hashMap[key].response }, null, 2)}
              </pre>
            </details>
          </td>
          <td>${hashMap[key].methods.join(", ")}</td>
          
          <td></td>
          <td>
          </td>
        `;
      }

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
              row.innerHTML = generateRowHTML(key, hashMap);

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
              status: "loading",
              dataSource: [],
              extras: [],
              queries: [],
              playurls: [],
            };
          }
        }

        request.getContent(function (body) {
          // add jsdoc
          let response;
          try {
            response = JSON.parse(body);
          } catch (e) {
            response = body;
          }

          /** @type {CubeResponse} */
          let cubeResponse = response;

          let responseData =
            cubeResponse.results && cubeResponse.results.map((r) => r.data);

          hashMap[query].response.push(
            typeof responseData === "string"
              ? JSON.parse(responseData)
              : responseData
          );

          hashMap[query].errors.push(cubeResponse && cubeResponse.error);

          hashMap[query].queries.push(
            cubeResponse && cubeResponse.results.map((r) => r.query)
          );

          const objQuery =
            typeof query === "string" ? JSON.parse(query) : query;

          hashMap[query].playurls.push(
            ...tryInPlayground(getPlayQueriesFromRawQuery(objQuery))
          );

          hashMap[query].dataSource.push(
            cubeResponse.results &&
              cubeResponse.results.map((r) => r.dataSource)
          );

          hashMap[query].extras.push(
            cubeResponse.results &&
              cubeResponse.results.map((r) => ({
                usedPreAggregations: r.usedPreAggregations,
                transformedQuery: r.transformedQuery,
              }))
          );

          if (cubeResponse && cubeResponse.error) {
            hashMap[query].status = "loading or error";
          } else {
            hashMap[query].status = "success";
          }
          // Clear the existing table
          tbody.innerHTML = "";
          // Populate the table with hashMap values

          for (var key in hashMap) {
            if (hashMap.hasOwnProperty(key)) {
              var row = win.document.createElement("tr");

              row.innerHTML = generateRowHTML(key, hashMap);
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

function getPlayQueriesFromRawQuery(rawQuery = {}, opts = {}) {
  const { message = "", exclude = "", include = "", log = false } = opts || {};

  const toText = JSON.stringify(rawQuery).toLowerCase();
  if (include && toText.includes(include.toLowerCase())) {
    return [];
  }

  if (exclude && !toText.includes(exclude.toLowerCase())) {
    return [];
  }

  const query = JSON.parse(JSON.stringify(rawQuery));

  if (query.timeDimensions) {
    const timeDimension = query.timeDimensions[0];
    const { compareDateRange } = timeDimension || {};
    if (compareDateRange) {
      const [current, previous] = compareDateRange || [];

      const currentTimedimensionDateRange = query.timeDimensions[0];
      delete currentTimedimensionDateRange.compareDateRange;
      currentTimedimensionDateRange.dateRange = current;

      const currentQuery = JSON.parse(
        JSON.stringify({
          ...query,
          timeDimensions: [currentTimedimensionDateRange],
        })
      );
      const currentUrl = tryInPlayground(currentQuery);

      const previousTimedimensionDateRange = query.timeDimensions[0];
      delete previousTimedimensionDateRange.compareDateRange;
      previousTimedimensionDateRange.dateRange = previous;

      const previousQuery = JSON.parse(
        JSON.stringify({
          ...query,
          timeDimensions: [previousTimedimensionDateRange],
        })
      );
      const previousUrl = tryInPlayground(previousQuery);

      // if (log) {
      //   // eslint-disable-next-line no-restricted-syntax
      //   console.log(
      //     JSON.stringify(
      //       {
      //         msg: `${message}: currentQuery`,
      //         debug: { currentUrl, currentQuery },
      //       },
      //       null,
      //       2
      //     )
      //   );
      //   // eslint-disable-next-line no-restricted-syntax
      //   console.log(
      //     JSON.stringify(
      //       {
      //         msg: `${message}: previousQuery`,
      //         debug: { previousUrl, previousQuery },
      //       },
      //       null,
      //       2
      //     )
      //   );
      // }

      return [currentQuery, previousQuery];
    }
  }
  const url = tryInPlayground(query);

  // if (log) {
  //   // eslint-disable-next-line no-restricted-syntax
  //   console.log(
  //     JSON.stringify(
  //       { msg: `${message}: debug cube query`, debug: { query, url } },
  //       null,
  //       2
  //     )
  //   );
  // }

  return [query];
}

function tryInPlayground(query) {
  if (Array.isArray(query)) {
    return query.map(tryInPlayground);
  }

  const playgroundUrl =
    "https://lfx-dev.cubecloud.dev/deployments/25/playground";
  const queryUrl = `query=${encodeURIComponent(JSON.stringify(query))}`;
  const url = `${playgroundUrl}?${queryUrl}`;
  return url;
}

/** @typedef {object} CubeResponse
 * @property {string} queryType
 * @property {object[]} results
 * @property {object} results.query
 * @property {string[]} results.query.dimensions
 * @property {object[]} results.query.order
 * @property {string} results.query.order.id
 * @property {boolean} results.query.order.desc
 * @property {object[]} results.query.filters
 * @property {string} results.query.filters.member
 * @property {string} results.query.filters.operator
 * @property {string[]} results.query.filters.values
 * @property {number} results.query.limit
 * @property {string} results.query.timezone
 * @property {object[]} results.query.timeDimensions
 * @property {number} results.query.rowLimit
 * @property {string} results.query.queryType
 * @property {object[]} results.data
 * @property {string} results.lastRefreshTime
 * @property {object} results.annotation
 * @property {string} results.dataSource
 * @property {string} results.dbType
 * @property {string} results.extDbType
 * @property {boolean} results.external
 * @property {boolean} results.slowQuery
 * @property {null} results.total
 * @property {object} pivotQuery
 * @property {string[]} pivotQuery.dimensions
 * @property {object[]} pivotQuery.order
 * @property {string} pivotQuery.order.id
 * @property {boolean} pivotQuery.order.desc
 * @property {object[]} pivotQuery.filters
 * @property {string} pivotQuery.filters.member
 * @property {string} pivotQuery.filters.operator
 * @property {string[]} pivotQuery.filters.values
 * @property {number} pivotQuery.limit
 * @property {string} pivotQuery.timezone
 * @property {object} pivotQuery.timeDimensions
 * @property {number} pivotQuery.rowLimit
 * @property {string} pivotQuery.queryType
 * @property {boolean} slowQuery
 */
