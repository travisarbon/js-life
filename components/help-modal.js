/* global React, LifeAnalysisUtils */
/**
 * HelpModal — keyboard shortcuts overlay dialog.
 * Props: showHelp, stateRef, refs, dispatch
 */
var HelpModal = function HelpModal(props) { // eslint-disable-line no-unused-vars
    if(!props.showHelp){ return null; }
    var stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    var onClose = function(){ LifeAnalysisUtils.toggleHelp(stateRef, refs, dispatch); };
    var isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
    var mod = isMac ? '\u2318' : 'Ctrl+';
    return (
        <div className="help-overlay" onClick={onClose}
            role="dialog" aria-modal="true" aria-labelledby="help-dialog-title"
            onKeyDown={function(e){
                if(e.key === 'Escape'){ onClose(); return; }
                if(e.key === 'Tab'){
                    var modal = e.currentTarget.querySelector('.help-modal');
                    if(!modal) return;
                    var focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                    if(focusable.length === 0) return;
                    var first = focusable[0], last = focusable[focusable.length - 1];
                    if(e.shiftKey){ if(document.activeElement === first){ e.preventDefault(); last.focus(); } }
                    else { if(document.activeElement === last){ e.preventDefault(); first.focus(); } }
                }
            }}>
            <div className="help-modal" onClick={function(e){ e.stopPropagation(); }}>
                <h3 className="help-title" id="help-dialog-title">Quick Reference</h3>
                <button type="button" className="btn help-close-x" onClick={onClose} aria-label="Close" title="Close">&times;</button>
                <table className="help-table">
                    <tbody>
                        <tr><th colSpan="2" scope="colgroup" className="help-section-heading">Keyboard shortcuts</th></tr>
                        <tr><td>Space</td><td>Play / Pause</td></tr>
                        <tr><td><span className="key-label">.</span> <span className="key-hint">(Period)</span></td><td>Step one generation</td></tr>
                        <tr><td>Shift+.</td><td>Step N generations</td></tr>
                        <tr><td><span className="key-label">,</span> <span className="key-hint">(Comma)</span></td><td>Step backward</td></tr>
                        <tr><td>R</td><td>Reset (random fill)</td></tr>
                        <tr><td>E</td><td>Empty board</td></tr>
                        <tr><td>{mod + "Z"}</td><td>Undo</td></tr>
                        <tr><td>S</td><td>Export PNG</td></tr>
                        <tr><td>X</td><td>Copy board as RLE</td></tr>
                        <tr><td>F</td><td>Fit live cells in view</td></tr>
                        <tr><td>{mod + "Wheel"}</td><td>Zoom in / out</td></tr>
                        <tr><td>Scroll / Trackpad</td><td>Pan viewport</td></tr>
                        <tr><td>Arrows</td><td>Pan viewport</td></tr>
                        <tr><td>Right-drag</td><td>Pan viewport</td></tr>
                        <tr><td>[</td><td>Rotate pattern CCW</td></tr>
                        <tr><td>]</td><td>Rotate pattern CW</td></tr>
                        <tr><td>{mod + "C"}</td><td>Copy selection</td></tr>
                        <tr><td>{mod + "V"}</td><td>Paste selection</td></tr>
                        <tr><td>Del</td><td>Delete selection</td></tr>
                        <tr><td>Esc</td><td>Cancel / close</td></tr>
                        <tr><td>D</td><td>Switch to Draw mode</td></tr>
                        <tr><td>P</td><td>Switch to Preset mode</td></tr>
                        <tr><td>B</td><td>Switch to Region mode</td></tr>
                        <tr><td>G</td><td>Toggle grid lines</td></tr>
                        <tr><td>T</td><td>Toggle trails</td></tr>
                        <tr><td>M</td><td>Toggle minimap</td></tr>
                        <tr><td>?</td><td>Show / hide this help</td></tr>
                        <tr><th colSpan="2" scope="colgroup" className="help-section-heading">Touch gestures</th></tr>
                        <tr><td>Tap</td><td>Paint / place cell</td></tr>
                        <tr><td>Pinch</td><td>Zoom in / out</td></tr>
                        <tr><td>2-finger drag</td><td>Pan viewport</td></tr>
                        <tr><td>Long press</td><td>Show cell coordinates</td></tr>
                        <tr><th colSpan="2" scope="colgroup" className="help-section-heading">File import</th></tr>
                        <tr><td>Drag &amp; drop</td><td>Drop .rle/.cells file on canvas</td></tr>
                        <tr><td>{mod + "V"}</td><td>Paste RLE text from clipboard</td></tr>
                    </tbody>
                </table>
                <button type="button" className="btn help-close" onClick={onClose} title="Close" aria-label="Close help dialog">Close</button>
            </div>
        </div>
    );
};
