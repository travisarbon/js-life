import React from 'react';
import { THEMES, SPEED_DELAYS } from '../constants.js';
import { LifeViewUtils } from '../life-view-utils.js';
import { LifeBoardUtils } from '../life-board-utils.js';
/**
 * Settings panel components extracted from LifeBoard.
 * Each component receives props: state, stateRef, refs, dispatch
 * ViewControls also receives onToggleTrails.
 */

const ViewControls = function ViewControls(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
    const onToggleTrails = props.onToggleTrails;
                return (
                    <div>
                    <label className="control-group-label">Visibility</label>
                    <div className="view-controls">
                        <button type="button" className="btn" onClick={function(){ LifeViewUtils.fitView(stateRef, refs, dispatch); }} title="Zoom to fit entire grid"><i className="fa fa-arrows-alt" aria-hidden="true"></i> Fit Grid</button>
                        <button type="button" className="btn" onClick={function(){ LifeViewUtils.fitLiveCells(stateRef, refs, dispatch); }} title="Zoom to fit live cells"><i className="fa fa-compress" aria-hidden="true"></i> Fit Cells</button>
                        <button type="button" className={"btn btn-toggle" + (state.gridLines ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleGridLines(stateRef, refs, dispatch); }} title="Toggle grid lines (G)" aria-pressed={state.gridLines}><i className="fa fa-th" aria-hidden="true"></i> Grid</button>
                        <button type="button" className={"btn btn-toggle" + (state.showTrails ? " active" : "")} onClick={function(){ onToggleTrails(stateRef, refs, dispatch); }} title="Show ghost trails (T)" aria-pressed={state.showTrails}><i className="fa fa-sun-o" aria-hidden="true"></i> Trails</button>
                        <button type="button" className={"btn btn-toggle" + (state.showMinimap ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleMinimap(stateRef, refs, dispatch); }} title="Show/hide minimap (M)" aria-pressed={state.showMinimap}><i className="fa fa-map-o" aria-hidden="true"></i> Minimap</button>
                        <button type="button" className={"btn btn-toggle" + (state.showStats ? " active" : "")} onClick={function(){ dispatch({type:'MERGE', payload:{showStats: !state.showStats}}); }} title="Show/hide stats overlay" aria-pressed={state.showStats}><i className="fa fa-bar-chart" aria-hidden="true"></i> Stats</button>
                    </div>
                    </div>
                );
};

const ZoomSlider = function ZoomSlider(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
                return (
                    <div className="sliders">
                        <label className="slider-title" htmlFor="slider-zoom">{"Zoom: " + state.cellSize + "\u00a0px/cell"}</label>
                        <div className="slider-row">
                            <input type="range" min="1" max="32" step="1"
                                id="slider-zoom" aria-label="Zoom level"
                                value={state.cellSize}
                                onChange={function(e){ LifeViewUtils.setZoom(stateRef, refs, dispatch, e); }} />
                        </div>
                    </div>
                );
};

const DisplaySettings = function DisplaySettings(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
                return (
                    <div className="display-settings">
                        <label className="control-group-label" htmlFor="select-theme">Display</label>
                        <div className="presets-col">
                            <select className="rule-preset-select"
                                id="select-theme" aria-label="Color theme"
                                value={state.theme}
                                onChange={function(e){ LifeBoardUtils.setTheme(stateRef, refs, dispatch, e); }}>
                                {Object.keys(THEMES).map(function(t){
                                    return <option key={t} value={t}>{t}</option>;
                                })}
                            </select>
                            <label className="control-group-label control-label-spaced" htmlFor="select-darkmode">Mode</label>
                            <select className="rule-preset-select"
                                id="select-darkmode" aria-label="Dark mode preference"
                                value={state.darkModePref}
                                onChange={function(e){ LifeBoardUtils.setDarkModePref(stateRef, refs, dispatch, e); }}
                                title="UI dark mode preference">
                                <option value="system">System</option>
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                            </select>
                        </div>
                    </div>
                );
};

const BoundaryControls = function BoundaryControls(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
                return (
                    <div className="boundary-controls">
                        <label className="control-group-label">Boundary</label>
                        <div className="view-controls">
                            <button type="button" className={"btn btn-toggle" + (state.boundary !== 'toroidal' ? " active" : "")} onClick={function(){ LifeBoardUtils.toggleBoundary(stateRef, refs, dispatch); }} title="Cycle boundary: Wrap / Hard / Infinite" aria-pressed={state.boundary !== 'toroidal'}>{state.boundary === 'toroidal' ? <i className="fa fa-repeat" aria-hidden="true"></i> : state.boundary === 'finite' ? <i className="fa fa-stop" aria-hidden="true"></i> : null}{state.boundary === 'unbounded' ? <span className="boundary-infinity">{"\u221E "}</span> : " "}{state.boundary === 'toroidal' ? "Wrap" : state.boundary === 'finite' ? "Hard" : "Infinite"}</button>
                        </div>
                    </div>
                );
};

const SpeedSlider = function SpeedSlider(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
                const delay = SPEED_DELAYS[state.speed - 1];
                const speedLabel = delay === 0 ? 'Max' : delay + ' ms/gen';
                return (
                    <div className="sliders">
                        <label className="slider-title" htmlFor="slider-speed">{"Speed: " + speedLabel}</label>
                        <div className="slider-row">
                            <input type="range" min="1" max="10"
                                id="slider-speed" aria-label="Simulation speed"
                                value={state.speed}
                                onChange={function(e){ LifeBoardUtils.setSpeed(stateRef, refs, dispatch, e); }} />
                        </div>
                    </div>
                );
};

const BoardSliders = function BoardSliders(props) { // eslint-disable-line no-unused-vars
    const state = props.state, stateRef = props.stateRef, refs = props.refs, dispatch = props.dispatch;
                const isUnbounded = state.boundary === 'unbounded';
                return (
                    <div className="sidebar-section">
                        {!isUnbounded && <div className="sliders">
                            <label className="slider-title" htmlFor="slider-width">{"Width: " + state.pendingCols}</label>
                            <div className="slider-row">
                                <input type="range" min="20" max="2000" step="10"
                                    id="slider-width" aria-label="Grid width"
                                    value={state.pendingCols}
                                    onChange={function(e){ LifeBoardUtils.setWidth(stateRef, refs, dispatch, e); }}
                                    onMouseUp={function(){ LifeBoardUtils.applyWidth(stateRef, refs, dispatch); }}
                                    onKeyDown={function(e){ LifeBoardUtils.onWidthKeyDown(stateRef, refs, dispatch, e); }}
                                    onTouchEnd={function(){ LifeBoardUtils.applyWidth(stateRef, refs, dispatch); }} />
                            </div>
                        </div>}
                        {!isUnbounded && <div className="sliders">
                            <label className="slider-title" htmlFor="slider-height">{"Height: " + state.pendingRows}</label>
                            <div className="slider-row">
                                <input type="range" min="20" max="2000" step="10"
                                    id="slider-height" aria-label="Grid height"
                                    value={state.pendingRows}
                                    onChange={function(e){ LifeBoardUtils.setHeight(stateRef, refs, dispatch, e); }}
                                    onMouseUp={function(){ LifeBoardUtils.applyHeight(stateRef, refs, dispatch); }}
                                    onKeyDown={function(e){ LifeBoardUtils.onHeightKeyDown(stateRef, refs, dispatch, e); }}
                                    onTouchEnd={function(){ LifeBoardUtils.applyHeight(stateRef, refs, dispatch); }} />
                            </div>
                        </div>}
                        {!isUnbounded && <div className="sliders">
                            <label className="slider-title">Grid presets</label>
                            <div className="grid-presets">
                                <button type="button" className="btn btn-xs" onClick={function(){ LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 100, 100); }} title="Set grid to 100×100">100²</button>
                                <button type="button" className="btn btn-xs" onClick={function(){ LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 200, 200); }} title="Set grid to 200×200">200²</button>
                                <button type="button" className="btn btn-xs" onClick={function(){ LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 400, 400); }} title="Set grid to 400×400">400²</button>
                                <button type="button" className="btn btn-xs" onClick={function(){ LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 1000, 1000); }} title="Set grid to 1000×1000">1000²</button>
                                <button type="button" className="btn btn-xs" onClick={function(){ LifeBoardUtils.applyGridPreset(stateRef, refs, dispatch, 2000, 2000); }} title="Set grid to 2000×2000">2000²</button>
                            </div>
                        </div>}
                        {isUnbounded && <div className="sliders">
                            <label className="slider-title unbounded-label">No bounding box — infinite canvas</label>
                        </div>}
                        <div className="sliders">
                            <label className="slider-title" htmlFor="slider-density">Random Fill Density</label>
                            <div className="slider-row">
                                <input type="range" min="2" max="7"
                                    id="slider-density" aria-label="Fill density"
                                    value={9 - state.sparseness}
                                    onChange={function(e){ LifeBoardUtils.setDensity(stateRef, refs, dispatch, e); }} />
                            </div>
                        </div>
                    </div>
                );
};

export { ViewControls, ZoomSlider, DisplaySettings, BoundaryControls, SpeedSlider, BoardSliders };
