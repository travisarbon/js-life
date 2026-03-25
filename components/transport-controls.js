/* global LifeSimUtils, LifeBoardUtils, LifeAnalysisUtils, LifeViewUtils, SPEED_DELAYS */
/**
 * TransportControls — Play/pause/step buttons + step count.
 * Props: compact, state, stateRef, refs, dispatch
 */
const TransportControls = function TransportControls(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    const compact = props.compact;

                if(compact){
                    const compactDelay = SPEED_DELAYS[state.speed - 1];
                    const compactSpeedLabel = compactDelay === 0 ? 'Max' : compactDelay + '\u2009ms';
                    return (
                        <div className="transport-controls transport-compact">
                            <button type="button" className={"btn btn-toggle" + (state.running ? " active" : "")} onClick={function(){ LifeSimUtils.toggleGame(stateRef, refs, dispatch); }} title="Play/Pause (Space)" data-tooltip={state.running ? "Pause (Space)" : "Play (Space)"} aria-label={state.running ? "Pause" : "Play"} aria-pressed={state.running}><i className={"fa " + (state.running ? "fa-pause" : "fa-play")} aria-hidden="true"></i></button>
                            <button type="button" className="btn" onClick={function(){ LifeSimUtils.stepGame(stateRef, refs, dispatch); }} title="Step one generation (.)" data-tooltip="Step (.)" aria-label="Step one generation"><i className="fa fa-step-forward" aria-hidden="true"></i></button>
                            <span className="transport-gen-label">{"Gen " + state.generations.toLocaleString()}</span>
                            <span className="transport-speed-label" data-tooltip="Simulation speed">{compactSpeedLabel}</span>
                        </div>
                    );
                }
                return (
                    <div className="transport-controls">
                        <button type="button" className={"btn btn-toggle" + (state.running ? " active" : "")} onClick={function(){ LifeSimUtils.toggleGame(stateRef, refs, dispatch); }} title="Start or pause the simulation (Space)" aria-pressed={state.running}><i className={"fa " + (state.running ? "fa-pause" : "fa-play")} aria-hidden="true"></i> {state.running ? "Pause" : "Play"}</button>
                        <button type="button" className="btn" onClick={function(){ LifeSimUtils.stepGame(stateRef, refs, dispatch); }} title="Advance one generation (Enter)"><i className="fa fa-step-forward" aria-hidden="true"></i> Step</button>
                        <button type="button" className="btn" onClick={function(){ LifeSimUtils.stepBack(stateRef, refs, dispatch); }} title="Step backward (,)" disabled={refs.genHistory && refs.genHistory.length === 0}><i className="fa fa-step-backward" aria-hidden="true"></i> Back</button>
                        <select className="toolbar-step-select" value={state.stepCount} onChange={function(e){ LifeBoardUtils.setStepCount(stateRef, refs, dispatch, e); }} title="Advance N generations">
                            <option value="1">1 gen</option>
                            <option value="10">10 gen</option>
                            <option value="50">50 gen</option>
                            <option value="100">100 gen</option>
                            <option value="500">500 gen</option>
                        </select>
                        <button type="button" className="btn" onClick={function(){ LifeSimUtils.stepN(stateRef, refs, dispatch, state.stepCount); }} title="Advance multiple generations"><i className="fa fa-fast-forward" aria-hidden="true"></i> Go</button>
                        <button type="button" className="btn" onClick={function(){ LifeBoardUtils.resetGame(stateRef, refs, dispatch); }} title="Randomize the board (R)"><i className="fa fa-refresh" aria-hidden="true"></i> Reset</button>
                        <button type="button" className="btn" onClick={function(){ LifeBoardUtils.emptyBoard(stateRef, refs, dispatch); }} title="Clear all cells (E)"><i className="fa fa-eraser" aria-hidden="true"></i> Empty</button>
                        <button type="button" className="btn" onClick={function(){ LifeSimUtils.undo(stateRef, refs, dispatch); }} title="Undo last board edit (Ctrl+Z)"><i className="fa fa-undo" aria-hidden="true"></i> Undo</button>
                    </div>
                );
};

/**
 * MobileTransportBar — Mobile transport bar.
 * Props: state, stateRef, refs, dispatch
 */
const MobileTransportBar = function MobileTransportBar(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;

                return (
                    <div className="mobile-transport-bar" role="toolbar" aria-label="Simulation transport">
                        <button type="button" className={"btn btn-toggle" + (state.running ? " active" : "")} onClick={function(){ LifeSimUtils.toggleGame(stateRef, refs, dispatch); }}
                            aria-label={state.running ? "Pause simulation" : "Play simulation"}>
                            <i className={"fa " + (state.running ? "fa-pause" : "fa-play")} aria-hidden="true"></i>
                        </button>
                        <button type="button" className="btn" onClick={function(){ LifeSimUtils.stepGame(stateRef, refs, dispatch); }} aria-label="Step one generation"><i className="fa fa-step-forward" aria-hidden="true"></i></button>
                        <button type="button" className="btn" onClick={function(){ LifeBoardUtils.resetGame(stateRef, refs, dispatch); }} aria-label="Reset simulation"><i className="fa fa-refresh" aria-hidden="true"></i></button>
                        <button type="button" className={"btn btn-toggle" + (state.panMode ? " active" : "")}
                            onClick={function(){ LifeBoardUtils.togglePanMode(stateRef, refs, dispatch); }}
                            aria-label={state.panMode ? "Switch to " + (state.drawMode === 'select' ? "select" : state.drawMode === 'preset' ? "preset" : state.drawMode === 'region' ? "region" : "draw") + " mode" : "Switch to pan mode"}
                            aria-pressed={state.panMode}>
                            <i className={"fa " + (state.panMode
                                ? (state.drawMode === 'select' ? "fa-crosshairs" : state.drawMode === 'preset' ? "fa-puzzle-piece" : state.drawMode === 'region' ? "fa-th" : "fa-pencil")
                                : "fa-hand-paper-o")} aria-hidden="true"></i>
                        </button>
                        <span className="mobile-transport-mode" aria-live="polite">
                            {state.panMode ? 'Pan'
                                : (state.drawMode === 'preset' && state.selectedPattern
                                ? state.selectedPattern
                                : (state.drawMode === 'select' ? 'Select' : state.drawMode === 'region' ? 'Region' : 'Draw'))}
                        </span>
                        <button type="button" className="btn" onClick={function(){ LifeAnalysisUtils.toggleHelp(stateRef, refs, dispatch); }} aria-label="Help" title="Keyboard shortcuts (?)">
                            <i className="fa fa-question-circle" aria-hidden="true"></i>
                        </button>
                        <button type="button" className={"btn btn-toggle btn-sheet-toggle" + (state.bottomSheetOpen ? " active" : "")}
                            onClick={function(){ LifeViewUtils.toggleBottomSheet(stateRef, refs, dispatch); }}
                            aria-expanded={state.bottomSheetOpen}
                            aria-label="Open controls panel"><i className="fa fa-ellipsis-h" aria-hidden="true"></i></button>
                    </div>
                );
};
