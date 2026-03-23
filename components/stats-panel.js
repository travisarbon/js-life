/* global React, CanvasRenderer, LifeAnalysisUtils, GPS_DISPLAY_DURATION */
/**
 * Stats-related render components extracted from LifeBoard.
 * Props: state, stateRef, refs, dispatch
 */

var SparklineSVG = function SparklineSVG(props) { // eslint-disable-line no-unused-vars
    var state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    var population = state.liveCells.size;
    var now2 = Date.now();
    var gpsText = (refs.measuredGps > 0 &&
        (state.running || now2 < (refs.gpsDisplayUntil || 0)))
        ? refs.measuredGps.toFixed(1) + '\u00a0gen/s' : '\u2014\u00a0gen/s';
    var fullHist = state.popHistory;
    var trendArrow = '';
    if(fullHist.length >= 5){
        var delta = fullHist[fullHist.length - 1] - fullHist[fullHist.length - 5];
        trendArrow = delta > 2 ? '\u2009\u25b2' : delta < -2 ? '\u2009\u25bc' : '\u2009\u223c';
    }
    var histStart = Math.max(0, fullHist.length - 60);
    var hist = histStart > 0 ? fullHist.slice(histStart) : fullHist;
    var maxPop = 0;
    for(var hi = 0; hi < hist.length; hi++){
        if(hist[hi] > maxPop){ maxPop = hist[hi]; }
    }
    if(hist.length <= 1){ return null; }
    var vbW = 200, vbH = 36, padT = 2, innerH = vbH - padT * 2;
    var spMax = maxPop || 1;
    var sparkPts = hist.map(function(p, idx){
        var x = hist.length === 1 ? vbW / 2 : (idx / (hist.length - 1)) * vbW;
        var y = padT + (1 - p / spMax) * innerH;
        return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    var spanLabel = hist.length >= 60 ? 'last 60 gen' : hist.length + ' gen';
    return (
        <div className="sparkline-wrap">
            <div className="sparkline-header">
                <span className="sparkline-title" onClick={function(){ LifeAnalysisUtils.togglePopGraph(stateRef, refs, dispatch); }} style={{cursor:'pointer'}} title="Click for full population graph">{"Pop: " + population.toLocaleString() + trendArrow}</span>
                <span className="sparkline-peak">{"peak " + maxPop.toLocaleString() + (state.sessionPeakPop > maxPop ? " \xb7 all " + state.sessionPeakPop.toLocaleString() : "")}</span>
            </div>
            <svg className="sparkline" width="100%" height={vbH}
                 viewBox={"0 0 " + vbW + " " + vbH}
                 preserveAspectRatio="none"
                 role="img" aria-label="Population sparkline">
                <line x1="0" y1={vbH - 0.5} x2={vbW} y2={vbH - 0.5}
                      stroke="rgba(244,233,225,0.25)" strokeWidth="1"/>
                <line x1="0" y1={padT + innerH / 2} x2={vbW} y2={padT + innerH / 2}
                      stroke="rgba(244,233,225,0.1)" strokeWidth="0.5"/>
                <polyline points={sparkPts} fill="none" stroke={CanvasRenderer._aliveRGB || '#70959A'}
                          strokeWidth="1.5" strokeLinejoin="round"
                          strokeLinecap="round"/>
            </svg>
            <div className="sparkline-footer">
                <span className="sparkline-gps">{gpsText || ''}</span>
                <span>{"← " + spanLabel + " →"}</span>
            </div>
        </div>
    );
};

var MobileSparkline = function MobileSparkline(props) { // eslint-disable-line no-unused-vars
    var svg = <SparklineSVG state={props.state} refs={props.refs} stateRef={props.stateRef} dispatch={props.dispatch} />;
    if(!svg){ return null; }
    return <div className="mobile-sparkline">{svg}</div>;
};

var StatsPanel = function StatsPanel(props) { // eslint-disable-line no-unused-vars
    var state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    var population = state.liveCells.size;
    var hc = state.hoverCell;
    var coordText = hc ? ('Col\u00a0' + hc.c + '\u2002Row\u00a0' + hc.r) : '\u2014';
    var sparkline = <SparklineSVG state={state} refs={refs} stateRef={stateRef} dispatch={dispatch} />;

    return (
        <div className="stats">
            <div className="stat-row">
                <span>{"Gen: " + state.generations.toLocaleString()}</span>
                <span className="board-dims">{state.cols + "\u00d7" + state.rows}</span>
            </div>
            <div className="stat-row">
                <div className="status-badges">
                    <span className={"status-indicator " + (state.running ? "status-running" : "status-paused")}>
                        {state.running ? "Running" : "Paused"}
                    </span>
                    {state.stable &&
                        <span className="status-indicator status-stable">Stable</span>
                    }
                </div>
                <div className="coord-display">{coordText}</div>
            </div>
            {sparkline || (
                <div className="sparkline-placeholder">
                    {"Pop: " + population.toLocaleString()}
                </div>
            )}
        </div>
    );
};

var StatsChip = function StatsChip(props) { // eslint-disable-line no-unused-vars
    var state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;

    return (
        <div className="stats-chip" onClick={function(){ LifeAnalysisUtils.togglePopGraph(stateRef, refs, dispatch); }}
            role="button" tabIndex="0" aria-atomic="true" aria-live="off"
            onKeyDown={function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); LifeAnalysisUtils.togglePopGraph(stateRef, refs, dispatch); } }}>
            <span>{"Gen " + state.generations.toLocaleString()}</span>
            <span>{"\u2002Pop " + state.liveCells.size.toLocaleString()}</span>
            <span className={"status-indicator status-icon " + (state.running ? "status-running" : "status-paused")}>
                <i className={"fa " + (state.stable ? "fa-check-circle" : (state.running ? "fa-play" : "fa-pause"))} />
                {" "}{state.stable ? "Stable" : (state.running ? "Run" : "Pause")}
            </span>
        </div>
    );
};
