const MAX_SCALE = 12;

function getCanvasContext() {
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');
    //ctx.imageSmoothingEnabled = false;

    return { canvas, ctx };
}

async function fetchData(url) {
    const response = await fetch(url);

    return await response.json();
}

function calculateScale(bbox, width, height) {
    const [x0, y0, x1, y1] = bbox;
    const bbox_width = x1 - x0;
    const bbox_height = y1 - y0;

    if (width / bbox_width < height / bbox_height) {
        return MAX_SCALE * width / bbox_width; // Limit scale by width
    } else {
        return MAX_SCALE * height / bbox_height; // Limit scale by height
    }
}

function getColor(value, min, max) {
    let ratio = (value - min) / (max - min);
    let r = 0, g = 0, b = 0;

    if (ratio < 0.33) {
        // In first third (blue to green), interpolate between blue and green
        r = 0;
        g = Math.floor(255 * (ratio / 0.33));
        b = 255 - Math.floor(255 * (ratio / 0.33));
    } else if (ratio < 0.67) {
        // In second third (green to yellow), interpolate between green and yellow
        r = Math.floor(255 * ((ratio - 0.33) / 0.34));
        g = 255;
        b = 0;
    } else {
        // In last third (yellow to orange), interpolate between yellow and orange
        r = 255;
        g = 255 - Math.floor(255 * ((ratio - 0.67) / 0.33));
        b = 0;
    }

    return `rgba(${r}, ${g}, ${b}, 1.0)`;
}


function createPaths(features, ctx, scale, bbox) {
    const [x0, y0, x1, y1] = bbox;
    const paths = [];

    features.forEach(feature => {

        // create array of _median, _median_2, _median_3, _median_4, ...
        const months = Object.keys(feature.properties).filter(key => key.includes('_median'));
        //console.log(months);

        // Get median value of feature.properties.months
        const median = months.reduce((acc, key) => acc + feature.properties[key], 0) / months.length;
        //console.log(median);

        // Get a colorValue for this feature
        const minRad = 8000;
        const maxRad = 22000;
        let colorValue = median;
        if (colorValue < minRad) colorValue = minRad;
        else if (colorValue > maxRad) colorValue = maxRad;
        ctx.fillStyle = getColor(colorValue, minRad, maxRad);

        feature.geometry.coordinates.forEach(arr => {
            arr.forEach(point => {

                // Create a path starting at first point
                let path = new Path2D();
                path.moveTo((point[0][0] - x0) * scale, (-point[0][1] + y1) * scale);

                // Add remaining points to path
                point.forEach(coord => {
                    path.lineTo((coord[0] - x0) * scale, (-coord[1] + y1) * scale);
                });

                // Draw and fill the path for this feature
                ctx.stroke(path);
                ctx.fill(path);

                paths.push({
                    path,
                    bbox: feature.bbox,
                    ...feature.properties
                });
            });
        });
    });

    return [paths, scale];
}

window.addEventListener("load", function () {

    const time0 = window.performance.now();
    console.log('Window load at ' + new Date().toLocaleTimeString());

    const { canvas, ctx } = getCanvasContext();

    let zoomScale = 1 / MAX_SCALE;
    let pointX = 0;
    let pointY = 0;
    canvas.style.transform = `scale(${zoomScale})`;
    canvas.style.transformOrigin = '0 0';



    fetchData('./data/hex025-srad-median.geo.json').then(data => {

        const time1 = window.performance.now();
        console.log(`Data fetched in ${((time1 - time0) / 1000).toFixed(3)} seconds`);

        const width = window.innerWidth * 0.9;
        const height = window.innerHeight * 0.9;
        const scale = calculateScale(data.bbox, width, height);
        canvas.width = (data.bbox[2] - data.bbox[0]) * scale;
        canvas.height = (data.bbox[3] - data.bbox[1]) * scale;

        console.log(`canvas width: ${canvas.width}, height: ${canvas.height}
            window width: ${width.toFixed(1)}, height: ${height.toFixed(1)}
            scale: ${scale.toFixed(1)}`)

        //ctx.lineWidth = 0.000001;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        console.log(ctx.lineWidth, ctx.strokeStyle);
        return createPaths(data.features, ctx, scale, data.bbox);
    }).then(([paths, time1]) => {

        const time2 = window.performance.now();
        console.log(`Paths created in ${((time2 - time1) / 1000).toFixed(3)} seconds`);

        const container = document.getElementById('canvas-container');
        document.getElementById('canvas-loading').innerHTML = "";
        document.getElementById('info-box').innerHTML = `Pan/zoom with mouse; click on the map to display info here.`;

        let isDown = false;
        let isPanning = false;
        let clickTime = 0;
        let startX;
        let startY;



        // Zoom in and out with mouse wheel
        canvas.onwheel = function (e) {
            e.preventDefault();

            // Get mouse position relative to canvas
            var xs = (e.clientX - pointX) / zoomScale;
            var ys = (e.clientY - pointY) / zoomScale;

            if (e.deltaY < 0) {
                if (zoomScale >= MAX_SCALE * (1 / 6)) return;   // limit zooming in
                zoomScale *= 1.2;
            } else {
                if (zoomScale <= 1 / MAX_SCALE) return;         // limit zooming out
                zoomScale /= 1.2;
            }

            // Adjust pointX and pointY to keep mouse position relative to canvas
            pointX = e.clientX - xs * zoomScale;
            pointY = e.clientY - ys * zoomScale;

            canvas.style.transform = `translate(${pointX}px, ${pointY}px) scale(${zoomScale})`;
        };


        container.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.clientX - pointX;
            startY = e.clientY - pointY;
        });

        // container.addEventListener('mouseleave', () => {
        //     isDown = false;
        // });

        container.addEventListener('mouseup', (event) => {

            isDown = false;
            if (isPanning) {
                isPanning = false;
                return;
            }

            // if (clickTime !== 0) {
            //     console.log(`WAITED ${(window.performance.now() - clickTime)} ms`);
            // }

            let rect = canvas.getBoundingClientRect();
            // print mouse position, startX, startY, pointX, pointY
            // console.log(`Mouse position: ${(event.clientX - rect.left)/zoomScale }, ${(event.clientY - rect.top)/zoomScale }`);
            // console.log(`clientX: ${event.clientX}, clientY: ${event.clientY}`)
            // console.log(`Start position: ${startX}, ${startY}`);
            // console.log(`Point position: ${pointX}, ${pointY}`);
            
            

            let clickX = event.offsetX
            let clickY = event.offsetY
            let infoBox = document.getElementById("info-box");

            let pathsChecked = 0;
            clickTime = window.performance.now();
            for (let pathData of paths) {
                pathsChecked++;
                if (ctx.isPointInPath(pathData.path, clickX, clickY)) {
                    console.log(pathData)
                    // console.log(`Path# ${pathsChecked} found; speed ${(pathsChecked/(window.performance.now() - clickTime)).toFixed(0)} paths/ms`);


                    ctx.fillStyle = "#cccccc";
                    ctx.fill(pathData.path);
                    ctx.stroke(pathData.path);

                    // Display pathData in <div id="info-box"> 
                    bboxData = pathData.bbox;
                    infoBox.innerHTML = `Latitude: ${(((bboxData[0] + bboxData[2]) / 2).toFixed(2))}, 
                                        Longitude: ${(((bboxData[1] + bboxData[3]) / 2).toFixed(2))},
                                        Monthly Solar Radiation (kJ/m^2/day):<br>
                                        Jan: ${pathData._median},
                                        Feb: ${pathData._median_2},
                                        Mar: ${pathData._median_3},
                                        Apr: ${pathData._median_4},
                                        May: ${pathData._median_5},
                                        Jun: ${pathData._median_6},
                                        Jul: ${pathData._median_7},
                                        Aug: ${pathData._median_8},
                                        Sep: ${pathData._median_9},
                                        Oct: ${pathData._median_10},
                                        Nov: ${pathData._median_11},
                                        Dec: ${pathData._median_12}
                                        `;

                    const responseTime = window.performance.now();
                    // console.log(`Click response in ${(responseTime - clickTime)} ms`);
                    clickTime = window.performance.now();
                }
            }
        });



        container.addEventListener('mousemove', (e) => {

            e.preventDefault();
            if (!isDown) return;
            isPanning = true;

            pointX = (e.clientX - startX);
            pointY = (e.clientY - startY);

            canvas.style.transform = `translate(${pointX}px, ${pointY}px) scale(${zoomScale})`;
        });

        // Warm up the function by simulating a click event
        let event = new MouseEvent('mouseup', {
            'view': window,
            'bubbles': true,
            'cancelable': true,
            'clientX': 50,
            'clientY': 101
        });
        canvas.dispatchEvent(event)
        console.log(event)
    }).catch(err => {
        console.error('Error while loading or processing data:', err);
    });
});
