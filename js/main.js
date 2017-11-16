//(function () {

//'use strict';

var canvas, ctx;
var audioContext;

var bbFunction;
var samplesPerPixel = 1000;

var playButton;

var playing = false;

var bytebeat;

// The time that we're currently playing.
var time = 0;

// The sample rate that we want.
var sampleRate = 8000;

function init() {
    initControls();
    initCanvas();
    initAudio();

    playButton = document.getElementById('play');
    playButton.addEventListener('click', togglePlayback);


    //updateBytebeat('t * ((t>>12|t>>8)&63&t>>4)');

    // Draw a screenfull of bytes.
    draw();



    var loops = 0;

    var bufferSize = 16384;//4096;
    var scriptNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
    var sampleRateAdjustment = sampleRate / audioContext.sampleRate;

    scriptNode.onaudioprocess = function(e) {
        var output = e.outputBuffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) {
            // Adjust the sample rate down to 8000.
            var t = Math.floor((time + i) * sampleRateAdjustment);
            output[i] = bytebeat.getByte(t) / 127.5 - 1;
        }
        time += bufferSize;
    }


    scriptNode.connect(audioContext.destination);
    audioContext.suspend();

    //console.log(scriptNode);
};

function initControls() {
    // Build any HTML controls needed.
    var presets = [
        '(((t*5&t>>6)^(t>>4|t>>2&t%255.004|t*3&t>>8)-10))|(((t*5&t>>6)^(t>>4|t>>2&t%255.004|t*3&t>>8)-10)/4)',
        't * ((t>>12|t>>8)&63&t>>4)',
        't*(t>>((t>>11)&15))*(t>>9&1)<<2',
        '((t<<1)^((t<<1)+(t>>7)&t>>12))|t>>(4-(1^7&(t>>19)))|t>>7',
        'u=t>>10,8*t*t*(t>>u%3+15)/(3+(u&(u>>5&3|4)))|t>>4',
        't*5&t>>7|t*3&t>>10|t>>4'
    ];

    var presetsEl = document.getElementById('presets');

    for (var i = 0; i < presets.length; i++) {
        var option = document.createElement('option');
        option.value = presets[i];
        option.text = presets[i];
        presetsEl.appendChild(option);
    }

    choosePreset(presets[0]);

    presetsEl.addEventListener('change', function (event) {
        if (event.target.value) {
            choosePreset(event.target.value);
        }
    });

    var form = document.getElementById('bytebeatForm');
    form.addEventListener('submit', function (event) {
        event.preventDefault();
        //console.log(window.bytebeat);
        updateBytebeat(event.target.bytebeat.value);
    });
}

function choosePreset(bbString) {
    var bytebeatEl = document.getElementById('bytebeat');
    bytebeatEl.value = bbString;
    updateBytebeat(bbString);
}

function updateBytebeat(bbString) {
    bytebeat = new Bytebeat(bbString);
}

function initCanvas() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
}

function initAudio() {
    var webAudioAPI = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.oAudioContext || window.msAudioContext;
    audioContext = new webAudioAPI();
    if (!audioContext) {
        throw new Error('Web audio API not supported.');
    }
}

function togglePlayback() {
    if (playing) {
        audioContext.suspend();
        playing = false;
    } else {
        audioContext.resume();
        playing = true;
    }
}

function draw() {
    window.requestAnimationFrame(draw);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var x, y, byte;
    ctx.fillStyle = '#fff';
    for (x = 0; x < canvas.width; x++) {
        byte = bytebeat.getByte(x * samplesPerPixel);
        for (y = 0; y < 256; y++) {
            if (byte & y) {
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }

    ctx.fillStyle = '#f00';
    ctx.fillRect(time / samplesPerPixel, 0, 1, 255);

}

function convertSampleRate(rate) {
    return Math.floor(rate * sampleRate / audioContext.sampleRate);
}


// Bytebeat constructor.
function Bytebeat(codeString) {
    this.sampleRate = 8000

    var f;
    eval('f = function (t) { return ' + codeString + '; };');
    this.tFunction = f;
};

// Get the byte value for the given time.
Bytebeat.prototype.getByte = function (t) {
    // Whatever the function returns, wrap it to a byte.
    return this.tFunction(t) & 0xff;// * 256;
};





function setBBFunction(codeString) {
    var f;
    eval('f = function (t) { return ' + codeString + '; };');
    bbFunction = f;
}





function makeURL() {
    var bitsPerSample = 16;
    var generated = generateSound();
    var frequency = generated[0];
    var samples = generated[1];
    var channels = generated[2];
    //generatePreview(samples, frequency, channels);
    return "data:audio/x-wav," + b(RIFFChunk(channels, bitsPerSample, frequency, samples));
}

function generateSound() {
    var frequency = 8000;
    var seconds = 8;

    var sampleArray = [];
    // var f = function (t) {
    //     return t * ((t>>12|t>>8)&63&t>>4);
    // };
	var channels = 1;

    for (var t = 0; t < frequency*seconds; t++) {
        var sample = bbFunction(t);
		sample = (sample & 0xff) * 256;

		//store left sample
		if (sample < 0) sample = 0;
        if (sample > 65535) sample = 65535
        sampleArray.push(sample);
    }
    //console.log(sampleArray);
    return [frequency, sampleArray, channels];
}

// [255, 0] -> "%FF%00"
function b(values) {
    var out = "";
    for (var i = 0; i < values.length; i++) {
        var hex = values[i].toString(16);
        if (hex.length == 1) hex = "0" + hex;
        out += "%" + hex;
    }
    return out.toUpperCase();
}

function RIFFChunk(channels, bitsPerSample, frequency, sampleArray) {
    var fmt = FMTSubChunk(channels, bitsPerSample, frequency);
    var data = dataSubChunk(channels, bitsPerSample, sampleArray);
    var header = [].concat(c("RIFF"), chunkSize(fmt, data), c("WAVE"));
    return [].concat(header, fmt, data);
}

function FMTSubChunk(channels, bitsPerSample, frequency) {
    var byteRate = frequency * channels * bitsPerSample/8;
    var blockAlign = channels * bitsPerSample/8;
    return [].concat(
        c("fmt "),
        split32bitValueToBytes(16), // Subchunk1Size for PCM
        [1, 0], // PCM is 1, split to 16 bit
        [channels, 0],
        split32bitValueToBytes(frequency),
        split32bitValueToBytes(byteRate),
        [blockAlign, 0],
        [bitsPerSample, 0]
    );
}

function split32bitValueToBytes(l) {
    return [l&0xff, (l&0xff00)>>8, (l&0xff0000)>>16, (l&0xff000000)>>24];
}

function chunkSize(fmt, data) {
    return split32bitValueToBytes(4 + (8 + fmt.length) + (8 + data.length));
}

function sampleArrayToData(sampleArray, bitsPerSample) {
    if (bitsPerSample === 8) return sampleArray;
    if (bitsPerSample !== 16) {
        alert("Only 8 or 16 bit supported.");
        return;
    }

    var data = [];
    for (var i = 0; i < sampleArray.length; i++) {
        data.push(0xff & sampleArray[i]);
        data.push((0xff00 & sampleArray[i])>>8);
    }
    return data;
}

function dataSubChunk(channels, bitsPerSample, sampleArray) {
    return [].concat(
        c("data"),
        split32bitValueToBytes(sampleArray.length * bitsPerSample/8),
        sampleArrayToData(sampleArray, bitsPerSample)
    );
}

// Character to ASCII value, or string to array of ASCII values.
function c(str) {
    if (str.length == 1) {
        return str.charCodeAt(0);
    } else {
        var out = [];
        for (var i = 0; i < str.length; i++) {
            out.push(c(str[i]));
        }
        return out;
    }
}













//var app;

window.addEventListener('load', function () {
    //var app = new App();
    init();
});

//})();
