import React from 'react';
import { PATTERNS, PATTERN_GROUPS, PATTERN_META } from '../patterns.js';
import { InputHandler } from '../input-handler.js';
import { LifeBoardUtils } from '../life-board-utils.js';
import { LifeAnalysisUtils } from '../life-analysis-utils.js';
import { drawBoard, drawRotationPreview } from './canvas-area.jsx';
/**
 * Tools-panel components extracted from LifeBoard.
 * ModeControls — draw mode toggle buttons + analyze.
 * ToolsContent — tool sub-type selectors, preset picker, selection actions.
 * MobileContextPanel — rotation / selection buttons shown on mobile.
 * Each component receives props: state, stateRef, refs, dispatch
 */

/** Cached pattern option list — avoids re-computing on every render.
 *  Returns array of <optgroup> elements filtered by search string. */
const _patternOptionsCache = {filter: null, hasCustom: false, result: null};
const _buildPatternOptions = function(filterStr) {
    const hasCustom = !!PATTERNS['Custom'];
    if(_patternOptionsCache.filter === filterStr && _patternOptionsCache.hasCustom === hasCustom){
        return _patternOptionsCache.result;
    }
    const filterLc = filterStr.toLowerCase();
    let options = Object.keys(PATTERN_GROUPS).map(function(group){
        const names = Object.keys(PATTERN_GROUPS[group]).filter(function(name){
            return !filterLc || name.toLowerCase().indexOf(filterLc) !== -1;
        });
        if(names.length === 0){ return null; }
        const opts = names.map(function(name){
            const meta = PATTERN_META[name];
            let title = '';
            if(meta){
                if(meta.type === 'Still life') title = 'Still life \xB7 ' + meta.cells + ' cells';
                else if(meta.type === 'Oscillator') title = 'Oscillator \xB7 Period\u00a0' + meta.period + ' \xB7 ' + meta.cells + ' cells';
                else if(meta.type === 'Spaceship') title = 'Spaceship \xB7 Period\u00a0' + meta.period + (meta.note ? ' \xB7 ' + meta.note : '');
                else if(meta.type === 'Methuselah') title = 'Methuselah \xB7 ' + meta.lifespan + '\u00a0gen lifespan \xB7 ' + meta.cells + ' cells';
                else if(meta.type === 'Gun') title = 'Gun \xB7 Period\u00a0' + meta.period + ' \xB7 ' + meta.cells + ' cells';
            }
            return <option key={name} value={name} title={title}>{name}</option>;
        });
        return <optgroup key={group} label={group}>{opts}</optgroup>;
    }).filter(function(x){ return x !== null; });
    if(hasCustom){
        options = options.concat(
            <optgroup key="custom" label="Custom"><option value="Custom">Custom</option></optgroup>
        );
    }
    _patternOptionsCache.filter = filterStr;
    _patternOptionsCache.hasCustom = hasCustom;
    _patternOptionsCache.result = options;
    return options;
};

const ModeControls = function ModeControls(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
                return (
                    <div>
                    <label className="control-group-label">Mode</label>
                    <div className="mode-controls">
                        <button type="button" className={"btn btn-toggle" + (state.drawMode === 'paint' ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleDrawMode(stateRef, refs, dispatch); }} title="Freehand draw mode (D)" aria-pressed={state.drawMode === 'paint'}><i className="fa fa-pencil" aria-hidden="true"></i> Draw</button>
                        <button type="button" className={"btn btn-toggle" + (state.drawMode === 'preset' ? " active" : "")} onClick={function(){ LifeBoardUtils.togglePresetMode(stateRef, refs, dispatch); }} title="Place preset patterns (P)" aria-pressed={state.drawMode === 'preset'}><i className="fa fa-puzzle-piece" aria-hidden="true"></i> Preset</button>
                        <button type="button" className={"btn btn-toggle" + (state.drawMode === 'select' ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleSelectMode(stateRef, refs, dispatch); }} title="Select and move cells (S)" aria-pressed={state.drawMode === 'select'}><i className="fa fa-mouse-pointer" aria-hidden="true"></i> Select</button>
                        {state.boundary !== 'unbounded' && <button type="button" className={"btn btn-toggle" + (state.drawMode === 'region' ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleRegionMode(stateRef, refs, dispatch); }} title="Draw/erase region bounds (B)" aria-pressed={state.drawMode === 'region'}><i className="fa fa-th" aria-hidden="true"></i> Region</button>}
                        <button type="button" className={"btn btn-toggle" + (state.livePaintMode ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleLivePaint(stateRef, refs, dispatch); }} title="Paint while running" aria-pressed={state.livePaintMode}><i className="fa fa-paint-brush" aria-hidden="true"></i> Live Paint</button>
                        <button type="button" className="btn" onClick={function(){ LifeAnalysisUtils.analyzePattern(stateRef, refs, dispatch); }} disabled={state.analyzing} title="Detect oscillator/spaceship"><i className="fa fa-crosshairs" aria-hidden="true"></i> Analyze</button>
                    </div>
                    </div>
                );
};

const ToolsContent = function ToolsContent(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;

                const patternOptions = _buildPatternOptions(state.patternFilter);
                return (
                    <div className="tools-content">
                        <div className="btn-section">
                            <div className="tool-subtype-row">
                                <label className="tool-label">Draw:</label>
                                <select value={state.drawTool}
                                        onChange={function(e){ dispatch({type:"MERGE", payload:{drawTool: e.target.value, drawMode: 'paint', selection: null}}); }}>
                                    <option value="cell">Cell paint</option>
                                    <option value="line">Line</option>
                                    <option value="fill">Flood fill</option>
                                    <option value="shape-rect">Rectangle</option>
                                    <option value="shape-circle">Circle</option>
                                </select>
                            </div>
                            <div className="tool-subtype-row">
                                <label className="tool-label">Select:</label>
                                <select value={state.selectTool}
                                        onChange={function(e){ dispatch({type:"MERGE", payload:{selectTool: e.target.value, drawMode: 'select', selection: null}}); }}>
                                    <option value="rect">Rectangle</option>
                                    <option value="ellipse">Ellipse</option>
                                    <option value="freeform">Freeform</option>
                                    <option value="all-visible">All visible</option>
                                </select>
                            </div>
                            {state.boundary !== 'unbounded' && <div className="tool-subtype-row">
                                <label className="tool-label">Region:</label>
                                <select value={state.regionTool}
                                        onChange={function(e){ dispatch({type:"MERGE", payload:{regionTool: e.target.value, drawMode: 'region'}}); }}>
                                    <option value="cell">Cell paint</option>
                                    <option value="line">Line</option>
                                    <option value="fill">Flood fill</option>
                                    <option value="shape-rect">Rectangle</option>
                                    <option value="shape-circle">Circle</option>
                                </select>
                            </div>}
                            <div className="tool-subtype-row">
                                <label className="tool-label">Preset:</label>
                                <select className={"preset-select" + (state.drawMode === 'preset' && state.selectedPattern ? " active" : "")}
                                    value={state.selectedPattern || ""}
                                    onChange={function(e){ LifeBoardUtils.selectPattern(stateRef, refs, dispatch, e); }}>
                                    <option value="">Choose preset...</option>
                                    {patternOptions}
                                </select>
                            </div>
                            <input className="pattern-filter-input"
                                type="search" placeholder="Filter patterns..."
                                aria-label="Filter patterns"
                                value={state.patternFilter}
                                onChange={function(e){ dispatch({type:"MERGE", payload:{patternFilter: e.target.value}}); }} />
                            {state.drawMode === 'preset' && state.selectedPattern &&
                                <div className="rotation-row">
                                    <canvas className="rotation-preview" width="96" height="96"
                                        role="img" aria-label="Pattern rotation preview"
                                        ref={function(c){ refs.previewCanvas = c; if(c) requestAnimationFrame(function(){ drawRotationPreview(stateRef, refs); }); }} />
                                    <div className="rotation-btns">
                                        <button type="button" className="btn btn-rotate" onClick={function(){ LifeBoardUtils.rotateCCW(stateRef, refs, dispatch); }} title="Rotate 90° counter-clockwise"><i className="fa fa-undo" aria-hidden="true"></i></button>
                                        <button type="button" className="btn btn-rotate" onClick={function(){ LifeBoardUtils.rotateCW(stateRef, refs, dispatch); }} title="Rotate 90° clockwise"><i className="fa fa-repeat" aria-hidden="true"></i></button>
                                        <button type="button" className="btn" onClick={function(){
                                            refs.previewPos = null;
                                            dispatch({type:"MERGE", payload:{selectedPattern: null, patternRotation: 0, drawMode: "paint"}});
                                                setTimeout(function(){ drawBoard(stateRef, refs); }, 0);
                                        }} aria-label="Cancel pattern placement" title="Cancel placement">
                                            <i className="fa fa-times" aria-hidden="true"></i>
                                        </button>
                                    </div>
                                </div>
                            }
                            {state.selection &&
                                <div className="buttons buttons-selection">
                                    <button type="button" className="btn" onClick={function(){ LifeBoardUtils.copySelection(stateRef, refs, dispatch); }} title="Copy selected cells" aria-label="Copy selected cells">Copy</button>
                                    <button type="button" className="btn" onClick={function(){ LifeBoardUtils.pasteAsPattern(stateRef, refs, dispatch); }}
                                        disabled={!state.clipboard || state.clipboard.length === 0} title="Paste copied cells" aria-label="Paste copied cells">Paste</button>
                                    <button type="button" className="btn" onClick={function(){ LifeBoardUtils.deleteSelection(stateRef, refs, dispatch); }} title="Delete selected cells" aria-label="Delete selected cells">Delete</button>
                                </div>
                            }
                        </div>
                    </div>
                );
};

/**
 * PresetContent — preset selector for use in compact mode pop-out.
 * Renders only the preset dropdown, filter, and rotation preview.
 */
const PresetContent = function PresetContent(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    const patternOptions = _buildPatternOptions(state.patternFilter);
    return (
        <div className="tools-content">
            <select className={"preset-select" + (state.drawMode === 'preset' && state.selectedPattern ? " active" : "")}
                value={state.selectedPattern || ""}
                onChange={function(e){ LifeBoardUtils.selectPattern(stateRef, refs, dispatch, e); }}>
                <option value="">Choose preset...</option>
                {patternOptions}
            </select>
            <input className="pattern-filter-input"
                type="search" placeholder="Filter patterns..."
                aria-label="Filter patterns"
                value={state.patternFilter}
                onChange={function(e){ dispatch({type:"MERGE", payload:{patternFilter: e.target.value}}); }} />
            {state.drawMode === 'preset' && state.selectedPattern &&
                <div className="rotation-row">
                    <canvas className="rotation-preview" width="96" height="96"
                        role="img" aria-label="Pattern rotation preview"
                        ref={function(c){ refs.previewCanvas = c; if(c) requestAnimationFrame(function(){ drawRotationPreview(stateRef, refs); }); }} />
                    <div className="rotation-btns">
                        <button type="button" className="btn btn-rotate" onClick={function(){ LifeBoardUtils.rotateCCW(stateRef, refs, dispatch); }} title="Rotate 90\xB0 counter-clockwise"><i className="fa fa-undo" aria-hidden="true"></i></button>
                        <button type="button" className="btn btn-rotate" onClick={function(){ LifeBoardUtils.rotateCW(stateRef, refs, dispatch); }} title="Rotate 90\xB0 clockwise"><i className="fa fa-repeat" aria-hidden="true"></i></button>
                        <button type="button" className="btn" onClick={function(){
                            refs.previewPos = null;
                            dispatch({type:"MERGE", payload:{selectedPattern: null, patternRotation: 0, drawMode: "paint"}});
                            setTimeout(function(){ drawBoard(stateRef, refs); }, 0);
                        }} aria-label="Cancel pattern placement" title="Cancel placement">
                            <i className="fa fa-times" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
            }
        </div>
    );
};

/**
 * DrawToolPopOut — draw tool sub-type selector for compact mode pop-out.
 */
const DrawToolPopOut = function DrawToolPopOut(props) { // eslint-disable-line no-unused-vars
    const state = props.state, dispatch = props.dispatch;
    return (
        <div className="tools-content">
            <div className="tool-subtype-row">
                <label className="tool-label">Draw:</label>
                <select value={state.drawTool}
                        onChange={function(e){ dispatch({type:"MERGE", payload:{drawTool: e.target.value, drawMode: 'paint', selection: null}}); }}>
                    <option value="cell">Cell paint</option>
                    <option value="line">Line</option>
                    <option value="fill">Flood fill</option>
                    <option value="shape-rect">Rectangle</option>
                    <option value="shape-circle">Circle</option>
                </select>
            </div>
        </div>
    );
};

/**
 * SelectToolPopOut — select tool sub-type selector for compact mode pop-out.
 */
const SelectToolPopOut = function SelectToolPopOut(props) { // eslint-disable-line no-unused-vars
    const state = props.state, dispatch = props.dispatch;
    return (
        <div className="tools-content">
            <div className="tool-subtype-row">
                <label className="tool-label">Select:</label>
                <select value={state.selectTool}
                        onChange={function(e){ dispatch({type:"MERGE", payload:{selectTool: e.target.value, drawMode: 'select', selection: null}}); }}>
                    <option value="rect">Rectangle</option>
                    <option value="ellipse">Ellipse</option>
                    <option value="freeform">Freeform</option>
                    <option value="all-visible">All visible</option>
                </select>
            </div>
        </div>
    );
};

/**
 * RegionToolPopOut — region tool sub-type selector for compact mode pop-out.
 */
const RegionToolPopOut = function RegionToolPopOut(props) { // eslint-disable-line no-unused-vars
    const state = props.state, dispatch = props.dispatch;
    return (
        <div className="tools-content">
            <div className="tool-subtype-row">
                <label className="tool-label">Region:</label>
                <select value={state.regionTool}
                        onChange={function(e){ dispatch({type:"MERGE", payload:{regionTool: e.target.value, drawMode: 'region'}}); }}>
                    <option value="cell">Cell paint</option>
                    <option value="line">Line</option>
                    <option value="fill">Flood fill</option>
                    <option value="shape-rect">Rectangle</option>
                    <option value="shape-circle">Circle</option>
                </select>
            </div>
        </div>
    );
};

const MobileContextPanel = function MobileContextPanel(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;

                const showRotation = state.drawMode === 'preset' && state.selectedPattern;
                const showSelection = state.selection !== null;
                if(!showRotation && !showSelection){ return null; }
                return (
                    <div className="mobile-context-panel">
                        {showRotation &&
                            <div className="rotation-btns">
                                <button type="button" className="btn btn-rotate" onClick={function(){ LifeBoardUtils.rotateCCW(stateRef, refs, dispatch); }}
                                    title="Rotate 90° counter-clockwise"><i className="fa fa-undo" aria-hidden="true"></i></button>
                                <button type="button" className="btn btn-rotate" onClick={function(){ LifeBoardUtils.rotateCW(stateRef, refs, dispatch); }}
                                    title="Rotate 90° clockwise"><i className="fa fa-repeat" aria-hidden="true"></i></button>
                                <button type="button" className="btn" onClick={function(){
                                    InputHandler._previewPos = null;
                                    dispatch({type:"MERGE", payload:{selectedPattern: null, patternRotation: 0, drawMode: "paint"}});
                                        setTimeout(function(){ drawBoard(stateRef, refs); }, 0);
                                }} aria-label="Cancel pattern placement" title="Cancel placement">
                                    <i className="fa fa-times" aria-hidden="true"></i>
                                </button>
                            </div>
                        }
                        {showSelection &&
                            <div className="buttons buttons-selection">
                                <button type="button" className="btn" onClick={function(){ LifeBoardUtils.copySelection(stateRef, refs, dispatch); }}
                                    disabled={!state.selection} title="Copy selected cells" aria-label="Copy selected cells">Copy</button>
                                <button type="button" className="btn" onClick={function(){ LifeBoardUtils.pasteAsPattern(stateRef, refs, dispatch); }}
                                    disabled={!state.clipboard || state.clipboard.length === 0} title="Paste copied cells" aria-label="Paste copied cells">Paste</button>
                                <button type="button" className="btn" onClick={function(){ LifeBoardUtils.deleteSelection(stateRef, refs, dispatch); }}
                                    disabled={!state.selection} title="Delete selected cells" aria-label="Delete selected cells">Delete</button>
                                <button type="button" className="btn" onClick={function(){
                                    dispatch({type:"MERGE", payload:{selection: null}}); setTimeout(function(){ drawBoard(stateRef, refs); }, 0);
                                }} title="Clear selection" aria-label="Clear selection">
                                    <i className="fa fa-times" aria-hidden="true"></i>
                                </button>
                            </div>
                        }
                    </div>
                );
};

export { ModeControls, ToolsContent, PresetContent, DrawToolPopOut, SelectToolPopOut, RegionToolPopOut, MobileContextPanel };
