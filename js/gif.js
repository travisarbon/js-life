/*!
 * Minimal GIF encoder — interface compatible with gif.js.
 * Supports animated GIFs from Canvas 2D contexts.
 * Uses LZW compression with 256-color palette per frame.
 */
(function(root){
    'use strict';

    // ── Bit stream writer ────────────────────────────────────────────────────
    function BitStream(output) {
        this._out   = output;
        this._buf   = 0;
        this._bits  = 0;
    }
    BitStream.prototype.write = function(val, nbits) {
        this._buf  |= (val & ((1 << nbits) - 1)) << this._bits;
        this._bits += nbits;
        while (this._bits >= 8) {
            this._out.push(this._buf & 0xFF);
            this._buf  >>>= 8;
            this._bits  -= 8;
        }
    };
    BitStream.prototype.flush = function() {
        if (this._bits > 0) {
            this._out.push(this._buf & 0xFF);
            this._buf  = 0;
            this._bits = 0;
        }
    };

    // ── LZW encoder (GIF variant) ─────────────────────────────────────────
    function lzwEncode(pixels, minCodeSize) {
        var clearCode = 1 << minCodeSize;
        var eoiCode   = clearCode + 1;
        var codeSize, maxCode, nextCode;
        var table  = {};
        var bytes  = [];
        var stream = new BitStream(bytes);

        function resetTable() {
            table    = {};
            codeSize = minCodeSize + 1;
            nextCode = eoiCode + 1;
            maxCode  = 1 << codeSize; // first code value that won't fit
        }

        // First clear code uses initial codeSize BEFORE reset.
        codeSize = minCodeSize + 1;
        maxCode  = 1 << codeSize;
        nextCode = eoiCode + 1;
        stream.write(clearCode, codeSize);
        resetTable();

        var prefix = -1;
        for (var i = 0; i < pixels.length; i++) {
            var px  = pixels[i];
            var key = (prefix < 0) ? (',' + px) : (prefix + ',' + px);
            if (prefix >= 0 && key in table) {
                prefix = table[key];
            } else {
                if (prefix >= 0) { stream.write(prefix, codeSize); }
                if (prefix >= 0) {
                    table[key] = nextCode++;
                    if (nextCode > maxCode) {
                        if (codeSize < 12) {
                            codeSize++;
                            maxCode = 1 << codeSize;
                        } else {
                            stream.write(clearCode, codeSize);
                            resetTable();
                        }
                    }
                }
                prefix = px;
            }
        }
        if (prefix >= 0) { stream.write(prefix, codeSize); }
        stream.write(eoiCode, codeSize);
        stream.flush();

        // Package into GIF sub-blocks (max 255 bytes each).
        var result = [minCodeSize];
        var off = 0;
        while (off < bytes.length) {
            var len = Math.min(255, bytes.length - off);
            result.push(len);
            for (var j = 0; j < len; j++) { result.push(bytes[off++]); }
        }
        result.push(0); // block terminator
        return result;
    }

    // ── Median-cut palette quantisation (simple uniform grid) ────────────
    function quantize(imageData, maxColors) {
        // Build a 6-bit (64-entry) colour cube, then pick most frequent.
        var freq = {};
        var data = imageData.data;
        for (var i = 0; i < data.length; i += 4) {
            var r = data[i]   & 0xF8;
            var g = data[i+1] & 0xF8;
            var b = data[i+2] & 0xF8;
            var k = (r << 16) | (g << 8) | b;
            freq[k] = (freq[k] || 0) + 1;
        }
        // Sort by frequency, take top (maxColors - 1); add black for safety.
        var entries = Object.keys(freq).map(function(k){ return {k: parseInt(k), n: freq[k]}; });
        entries.sort(function(a, b){ return b.n - a.n; });
        var palette = [];
        for (var j = 0; j < Math.min(maxColors - 1, entries.length); j++) {
            var c = entries[j].k;
            palette.push([(c >>> 16) & 0xFF, (c >>> 8) & 0xFF, c & 0xFF]);
        }
        // Always include a black entry.
        palette.push([0, 0, 0]);
        // Pad to exactly 256 entries.
        while (palette.length < maxColors) { palette.push([0, 0, 0]); }
        return palette;
    }

    // Map each pixel to nearest palette index (using squared RGB distance).
    function mapPixels(imageData, palette) {
        var data    = imageData.data;
        var pixels  = new Uint8Array(data.length / 4);
        for (var i = 0; i < pixels.length; i++) {
            var r = data[i * 4];
            var g = data[i * 4 + 1];
            var b = data[i * 4 + 2];
            var best = 0, bestDist = Infinity;
            for (var j = 0; j < palette.length; j++) {
                var dr = r - palette[j][0];
                var dg = g - palette[j][1];
                var db = b - palette[j][2];
                var d  = dr*dr + dg*dg + db*db;
                if (d < bestDist) { bestDist = d; best = j; }
            }
            pixels[i] = best;
        }
        return pixels;
    }

    // ── Byte array helpers ───────────────────────────────────────────────
    function word(n) { return [n & 0xFF, (n >> 8) & 0xFF]; }

    // ── GIF class ────────────────────────────────────────────────────────
    function GIFEncoder(options) {
        options = options || {};
        this._frames  = [];
        this._quality = options.quality || 10;
        this._handlers = {};
        this._aborted  = false;
    }

    GIFEncoder.prototype.on = function(event, fn) {
        this._handlers[event] = fn;
        return this;
    };

    GIFEncoder.prototype.addFrame = function(ctx, opts) {
        if (this._aborted) { return; }
        opts = opts || {};
        var canvas = ctx.canvas;
        var w = canvas.width, h = canvas.height;
        var imageData = ctx.getImageData(0, 0, w, h);
        this._frames.push({ imageData: imageData, w: w, h: h, delay: opts.delay || 100 });
    };

    GIFEncoder.prototype.render = function() {
        if (this._aborted || this._frames.length === 0) { return; }
        var self = this;
        // Use a timeout to yield to the browser before heavy work.
        setTimeout(function() {
            try {
                var blob = self._encode();
                if (self._handlers['finished']) { self._handlers['finished'](blob); }
            } catch(ex) {
                if (self._handlers['error']) { self._handlers['error'](ex); }
            }
        }, 10);
    };

    GIFEncoder.prototype.abort = function() {
        this._aborted = true;
        this._frames  = [];
    };

    GIFEncoder.prototype._encode = function() {
        var frames = this._frames;
        var w = frames[0].w, h = frames[0].h;
        var buf = [];

        // Build a global palette from the first frame.
        var palette = quantize(frames[0].imageData, 256);
        var colorDepth = 8; // log2(256)

        // GIF Header.
        'GIF89a'.split('').forEach(function(c){ buf.push(c.charCodeAt(0)); });

        // Logical Screen Descriptor.
        buf = buf.concat(word(w), word(h));
        // Global CT flag=1, color resolution=7, sort=0, size=7 (256 colors).
        buf.push(0xF7, 0, 0);

        // Global Color Table.
        for (var i = 0; i < 256; i++) {
            buf.push(palette[i][0], palette[i][1], palette[i][2]);
        }

        // Application Extension (NETSCAPE loop block).
        buf = buf.concat([0x21, 0xFF, 0x0B]);
        'NETSCAPE2.0'.split('').forEach(function(c){ buf.push(c.charCodeAt(0)); });
        buf = buf.concat([0x03, 0x01, 0x00, 0x00, 0x00]);

        // Frames.
        for (var fi = 0; fi < frames.length; fi++) {
            var f       = frames[fi];
            var pixels  = mapPixels(f.imageData, palette);
            var delayCs = Math.round((f.delay || 100) / 10); // centiseconds

            // Graphics Control Extension.
            buf = buf.concat([0x21, 0xF9, 0x04, 0x00]);
            buf = buf.concat(word(delayCs));
            buf = buf.concat([0x00, 0x00]);

            // Image Descriptor.
            buf.push(0x2C);
            buf = buf.concat(word(0), word(0), word(w), word(h), 0x00);

            // Image data (LZW-encoded).
            buf = buf.concat(lzwEncode(pixels, colorDepth));
        }

        // Trailer.
        buf.push(0x3B);

        return new Blob([new Uint8Array(buf)], {type: 'image/gif'});
    };

    root.GIF = GIFEncoder;

})(typeof window !== 'undefined' ? window : this);
