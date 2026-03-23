/* global React, LifeBoardUtils, LifeIOUtils, LifeAnalysisUtils, RULE_PRESETS */
/**
 * Rules and export panel components extracted from LifeBoard.
 * Each component receives props: state, stateRef, refs, dispatch
 */

var RulesSection = function RulesSection(props) { // eslint-disable-line no-unused-vars
    var state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
                var ruleValid = /^B[0-8]*\/?S[0-8]*$/i.test(state.ruleString);
                return (
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Rules</div>
                        <div className="presets-col">
                            <select className="rule-preset-select"
                                aria-label="Rule preset"
                                value={state.rulePreset}
                                onChange={function(e){ LifeBoardUtils.setRulePreset(stateRef, refs, dispatch, e); }}>
                                <option value="">Rule preset...</option>
                                {RULE_PRESETS.map(function(p){
                                    return <option key={p.rule} value={p.rule}>{p.name}</option>;
                                })}
                            </select>
                            <label className="slider-title rule-label">Rule (B/S notation)</label>
                            <input className={"rule-input" + (ruleValid ? "" : " rule-input-invalid")}
                                type="text"
                                value={state.ruleString}
                                onChange={function(e){ LifeBoardUtils.setRule(stateRef, refs, dispatch, e); }}
                                title="Birth/Survival rule string (e.g. B3/S23)" />
                        </div>
                    </div>
                );
};

var RLESection = function RLESection(props) { // eslint-disable-line no-unused-vars
    var state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
                return (
                    <div className="sidebar-section">
                        <div className="rle-section">
                            <div className="buttons rle-toggle-row">
                                <button type="button" className={"btn btn-rle-toggle btn-block" + (state.showRle ? " active" : "")}
                                    onClick={function(){ LifeIOUtils.toggleRle(stateRef, refs, dispatch); }}
                                    aria-pressed={state.showRle}>Import RLE / Plaintext</button>
                            </div>
                            {state.showRle &&
                                <div className="rle-body">
                                    <textarea className="rle-input"
                                        rows="5"
                                        placeholder={"Paste RLE or plaintext pattern\n(from LifeWiki or Golly)"}
                                        value={state.rleInput}
                                        onChange={function(e){ LifeIOUtils.setRleInput(stateRef, refs, dispatch, e); }} />
                                    <button type="button" className="btn btn-block" onClick={function(){ LifeIOUtils.loadRle(stateRef, refs, dispatch); }} title="Load the RLE or plaintext pattern">Load pattern</button>
                                    {state.rleError &&
                                        <p className="rle-error">{state.rleError}</p>
                                    }
                                </div>
                            }
                        </div>
                    </div>
                );
};

var ExportContent = function ExportContent(props) { // eslint-disable-line no-unused-vars
    var state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
                return (
                    <div className="export-content">
                        <div className="sidebar-section-title">Share</div>
                        <div className="btn-section">
                            <label className="control-group-label">Export</label>
                            <div className="buttons buttons-export">
                                <button type="button" className="btn" onClick={function(){ LifeIOUtils.exportPNG(stateRef, refs, dispatch); }} title="Save as PNG"><i className="fa fa-camera" aria-hidden="true"></i> Export PNG</button>
                                <button type="button" className="btn" onClick={function(){ LifeIOUtils.copyRLE(stateRef, refs, dispatch); }} title="Copy board as RLE"><i className="fa fa-clipboard" aria-hidden="true"></i> {state.copyRleTooltip ? "Copied!" : "Copy RLE"}</button>
                                <button type="button" className={"btn btn-toggle" + (state.recording ? " active btn-record" : "")} onClick={function(){ LifeAnalysisUtils.toggleRecording(stateRef, refs, dispatch); }} title="Record an animated GIF" aria-label={state.recording ? "Stop recording" : "Record GIF"} aria-pressed={state.recording}><i className={"fa " + (state.recording ? "fa-stop" : "fa-circle")} aria-hidden="true"></i> {state.recording ? "Stop" : "Record"}</button>
                                <button type="button" className="btn" onClick={function(){ LifeIOUtils.shareURL(stateRef, refs, dispatch); }} title="Copy shareable URL to clipboard" aria-label="Share simulation URL"><i className="fa fa-share-alt" aria-hidden="true"></i> {state.shareTooltip ? "Copied!" : "Share Link"}</button>
                            </div>
                            {<RLESection state={state} stateRef={stateRef} refs={refs} dispatch={dispatch} />}
                        </div>
                    </div>
                );
};
