/* global React, CanvasRenderer, LifeAnalysisUtils */
/**
 * PopGraphModal — full population history graph overlay.
 * Props: showPopGraph, popHistory, stateRef, refs, dispatch
 */
var PopGraphModal = function PopGraphModal(props) { // eslint-disable-line no-unused-vars
    if(!props.showPopGraph){ return null; }
    var hist = props.popHistory;
    if(!hist || hist.length < 2){ return null; }
    var stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    var onClose = function(){ LifeAnalysisUtils.togglePopGraph(stateRef, refs, dispatch); };

    var maxPop = 0;
    for(var i = 0; i < hist.length; i++){ if(hist[i] > maxPop){ maxPop = hist[i]; } }
    if(maxPop === 0){ maxPop = 1; }
    var vbW = 600, vbH = 200, padT = 10, padB = 20, padL = 50, padR = 10;
    var plotW = vbW - padL - padR;
    var plotH = vbH - padT - padB;
    var points = hist.map(function(p, idx){
        var x = padL + (idx / (hist.length - 1)) * plotW;
        var y = padT + (1 - p / maxPop) * plotH;
        return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    var yLabels = [];
    var ySteps = 4;
    for(var yi = 0; yi <= ySteps; yi++){
        var val = Math.round(maxPop * (1 - yi / ySteps));
        var yy = padT + (yi / ySteps) * plotH;
        yLabels.push({val: val, y: yy});
    }
    return (
        <div className="help-overlay" onClick={onClose}
            role="dialog" aria-modal="true" aria-labelledby="popgraph-dialog-title"
            onKeyDown={function(e){
                if(e.key === 'Tab'){
                    var modal = e.currentTarget.querySelector('.pop-graph-modal');
                    if(!modal) return;
                    var focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                    if(focusable.length === 0) return;
                    var first = focusable[0], last = focusable[focusable.length - 1];
                    if(e.shiftKey){ if(document.activeElement === first){ e.preventDefault(); last.focus(); } }
                    else { if(document.activeElement === last){ e.preventDefault(); first.focus(); } }
                }
            }}>
            <div className="pop-graph-modal" onClick={function(e){ e.stopPropagation(); }}>
                <h3 className="help-title" id="popgraph-dialog-title">Population History</h3>
                <p style={{fontSize:'0.8em',opacity:0.7,margin:'0 0 8px'}}>{hist.length + ' generations recorded \xB7 peak ' + maxPop.toLocaleString()}</p>
                <svg width="100%" viewBox={"0 0 " + vbW + " " + vbH} style={{background:'rgba(0,0,0,0.15)',borderRadius:'4px'}} role="img" aria-label="Population history graph">
                    {yLabels.map(function(yl, idx){
                        return <g key={idx}>
                            <line x1={padL} y1={yl.y} x2={vbW - padR} y2={yl.y} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
                            <text x={padL - 5} y={yl.y + 4} textAnchor="end" fill="rgba(255,255,255,0.6)" fontSize="10">{yl.val.toLocaleString()}</text>
                        </g>;
                    })}
                    <text x={padL + plotW / 2} y={vbH - 2} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9">Generation</text>
                    <polyline fill="none" stroke={CanvasRenderer._aliveRGB || '#70959A'} strokeWidth="1.5" points={points}/>
                    <polygon fill={CanvasRenderer._aliveRGB ? CanvasRenderer._aliveRGB.replace('rgb', 'rgba').replace(')', ',0.2)') : 'rgba(112,149,154,0.2)'} points={padL + ',' + (padT + plotH) + ' ' + points + ' ' + (padL + plotW) + ',' + (padT + plotH)}/>
                </svg>
                <button type="button" className="btn help-close" onClick={onClose} title="Close" aria-label="Close population graph">Close</button>
            </div>
        </div>
    );
};
