// JavaScript per animazione canvas e altre funzionalità

const canvas = document.getElementById("arrows");
const ctx = canvas.getContext("2d");

const items = [];
const spacing = 50; 

function setupGrid() {
    items.length = 0;
    const cols = Math.ceil(canvas.width / spacing) + 2;
    const rows = Math.ceil(canvas.height / spacing) + 2;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            items.push({
                x: (x - 1) * spacing,
                y: (y - 1) * spacing,
                angle: Math.random() * Math.PI * 2,
                type: (x + y) % 2 === 0 ? 'racket' : 'ball',
                scale: 0.8 + Math.random() * 0.4,
                animationOffset: Math.random() * 1000
            });
        }
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    setupGrid();
}

window.addEventListener("resize", resize);
resize();

function drawTennisRacket(x, y, gridAngle, scale, swingAngle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(gridAngle);
    ctx.scale(scale, scale);
    
    ctx.translate(0, 18);
    ctx.rotate(swingAngle);
    ctx.translate(0, -18);

    const strokeColor = getComputedStyle(document.body).getPropertyValue('--marrone').trim();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.bezierCurveTo(12, -15, 12, 0, 8, 2);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.lineTo(-8, 2);
    ctx.bezierCurveTo(-12, 0, -12, -15, 0, -15);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(0, 18);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    const headWidth = 7;
    const headHeight = 11;
    ctx.beginPath();
    ctx.moveTo(-headWidth, -headHeight / 2);
    ctx.lineTo(headWidth, -headHeight / 2);
    ctx.moveTo(-headWidth, 0);
    ctx.lineTo(headWidth, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-headWidth / 2, -headHeight);
    ctx.lineTo(-headWidth / 2, 2);
    ctx.moveTo(headWidth / 2, -headHeight);
    ctx.lineTo(headWidth / 2, 2);
    ctx.stroke();

    ctx.restore();
}

function drawTennisBall(x, y, scale, spinAngle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(spinAngle);

    const strokeColor = getComputedStyle(document.body).getPropertyValue('--marrone').trim();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 6, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 6, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    
    ctx.restore();
}

function animate(time) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    items.forEach(item => {
        const dx = item.x - centerX;
        const dy = item.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const gridAngle = Math.atan2(dy, dx) + Math.sin(time * 0.001 + dist * 0.01) * 0.5;
        const animationSpeed = 0.002;
        const animationValue = Math.sin(time * animationSpeed + item.animationOffset);

        if (item.type === 'racket') {
            const swingAngle = animationValue * 0.15;
            drawTennisRacket(item.x, item.y, gridAngle, item.scale, swingAngle);
        } else {
            const spinAngle = time * 0.001 + item.animationOffset;
            drawTennisBall(item.x, item.y, item.scale, spinAngle);
        }
    });

    requestAnimationFrame(animate);
}

animate(0);

// LOGICA PER CAMBIO TEMA
document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
});

// LOGICA PER SMOOTH SCROLL CON JQUERY
$(document).ready(function() {
    $('a[href^="#"]').on('click', function(event) {
        var target = $(this.getAttribute('href'));
        if (target.length) {
            event.preventDefault();
            $('html, body').stop().animate({
                scrollTop: target.offset().top
            }, 800);
        }
    });
});