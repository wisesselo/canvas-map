const MAX_SCALE = 12;

function getCanvasContext() {
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');

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

function createPaths(features, ctx, scale, bbox) {
    const [x0, y0, x1, y1] = bbox;
    const paths = [];

    features.forEach(feature => {
        // Get a colorValue for this feature
        let colorValue = feature.properties._median / 100;

        if (colorValue < 0 || isNaN(colorValue)) {
            colorValue = 0;
        } else if (colorValue > 255) {
            colorValue = 255;
        }

        ctx.fillStyle = `rgba(${colorValue}, 0, ${255 - colorValue}, 0.9)`;


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
    ctx.lineWidth = 0.01;


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

        return createPaths(data.features, ctx, scale, data.bbox);
    }).then(([paths, time1]) => {

        const time2 = window.performance.now();
        console.log(`Paths created in ${((time2 - time1) / 1000).toFixed(3)} seconds`);

        const container = document.getElementById('canvas-container');
        document.getElementById('canvas-loading').innerHTML = "";

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
                zoomScale *= 1.1;
            } else {
                if (zoomScale <= 1 / MAX_SCALE) return;         // limit zooming out
                zoomScale /= 1.1;
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

            if (clickTime !== 0) {
                console.log(`WAITED ${((window.performance.now() - clickTime) / 1000).toFixed(3)} s`);
            }

            clickTime = window.performance.now();

            let clickX = event.offsetX
            let clickY = event.offsetY
            let infoBox = document.getElementById("info-box");

            for (let pathData of paths) {
                if (ctx.isPointInPath(pathData.path, clickX, clickY)) {

                    const responseTime = window.performance.now();
                    console.log(`Click response in ${((responseTime - clickTime) / 1000).toFixed(3)} s`);
                    clickTime = window.performance.now();

                    ctx.fillStyle = "#cccccc";
                    ctx.fill(pathData.path);
                    ctx.stroke(pathData.path);

                    // Display pathData in <div id="info-box"> 
                    bboxData = pathData.bbox;
                    infoBox.innerHTML = `Latitude: ${(((bboxData[0] + bboxData[2]) / 2).toFixed(2))}, 
                                        Longitude: ${(((bboxData[1] + bboxData[3]) / 2).toFixed(2))},
                                        Monthly Solar Radiation:<br>
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

        ;
    }).catch(err => {
        console.error('Error while loading or processing data:', err);
    });
});
