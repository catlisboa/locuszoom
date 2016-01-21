/* global LocusZoom */
/* eslint-env browser */
/* eslint-disable no-console */

"use strict";

/**

  LocusZoom.Instance Class

  An instance is an independent LocusZoom object. Many instances can exist simultaneously
  on a single page, each having its own data caching, configuration, and state.

*/

LocusZoom.Instance = function(id, datasource, layout, state) {

    this.initialized = false;

    this.id = id;
    this.parent = LocusZoom;
    
    this.svg = null;

    // The _panels property stores child panel instances
    this._panels = {};
    
    // The state property stores any instance-wide parameters subject to change via user input
    this.state = state || {
        chr: 0,
        start: 0,
        end: 0
    };
    
    // The view property contains parameters that define the physical space of the entire LocusZoom object
    this.view = {
        width: 0,
        height: 0
    };

    // LocusZoom.Data.Requester
    this.lzd = new LocusZoom.Data.Requester(datasource);
    
    return this;
  
};

// Set the view dimensions for this instance. If an SVG exists, update its dimensions
LocusZoom.Instance.prototype.setDimensions = function(width, height){
    if (!isNaN(width)){
        this.view.width = Math.max(Math.round(+width),0);
    }
    if (!isNaN(height)){
        this.view.height = Math.max(Math.round(+height),0);
    }
    if (this.svg != null){
        this.svg.attr("width", this.view.width).attr("height", this.view.height);
    }
    if (this.initialized){
        this.stackPanels();
    }
    return this;
};

// Create a new panel by panel class
LocusZoom.Instance.prototype.addPanel = function(PanelClass){
    if (typeof PanelClass !== "function"){
        return false;
    }
    var panel = new PanelClass();
    panel.parent = this;
    this._panels[panel.id] = panel;
    this.stackPanels();
    return this._panels[panel.id];
};

// Automatically position panels vertically with equally proportioned heights
LocusZoom.Instance.prototype.stackPanels = function(PanelClass){
    var proportional_height = 1 / Object.keys(this._panels).length;
    var discrete_height = this.view.height * proportional_height;
    var panel_idx = 0;
    for (var id in this._panels){
        this._panels[id].view.proportional_height = proportional_height;
        this._panels[id].setOrigin(0, panel_idx * discrete_height);
        this._panels[id].setDimensions(this.view.width, discrete_height);
        panel_idx++;
    }
};

// Call initialize on all child panels
LocusZoom.Instance.prototype.initialize = function(){

    // Create the curtain object with svg element and drop/raise methods
    var curtain_svg = this.svg.append("g")
        .attr("class", "lz-curtain").style("display", "none")
        .attr("id", this.id + ".curtain");
    this.curtain = {
        svg: curtain_svg,
        drop: function(message){
            this.svg.style("display", null);
            if (typeof message != "undefined"){
                this.svg.select("text").selectAll("tspan").remove();
                message.split("\n").forEach(function(line){
                    this.svg.select("text").append("tspan")
                        .attr("x", "1em").attr("dy", "1.5em").text(line);
                }.bind(this));
            }
        },
        raise: function(){
            this.svg.style("display", "none");
        }
    };
    this.curtain.svg.append("rect");
    this.curtain.svg.append("text")
        .attr("id", this.id + ".curtain_text")
        .attr("x", "1em").attr("y", "0em");

    // Initialize all panels
    for (var id in this._panels){
        this._panels[id].initialize();
    }

    // Flip the "initialized" bit
    this.initialized = true;

    return this;

};

// Map an entire LocusZoom Instance to a new region
LocusZoom.Instance.prototype.mapTo = function(chr, start, end){

    // Apply new state values
    // TODO: preserve existing state until new state is completely loaded+rendered or aborted?
    this.state.chr   = +chr;
    this.state.start = +start;
    this.state.end   = +end;

    // Trigger reMap on each Panel
    for (var id in this._panels){
        this._panels[id].reMap();
    }

    return this;
    
};


/******************
  Default Instance
  - During alpha development this class definition can serve as a functional draft of the API
  - The default instance should therefore have/do "one of everything" (however possible)
  - Ultimately the default instance should stand up the most commonly configured LZ use case
*/

LocusZoom.DefaultInstance = function(){

    LocusZoom.Instance.apply(this, arguments);

    this.setDimensions(700,700);
  
    this.addPanel(LocusZoom.PositionsPanel)
        .setMargin(20, 20, 35, 50);
    this._panels.positions.addDataLayer(LocusZoom.PositionsDataLayer).attachToYAxis(1);
    //this._panels.positions.addDataLayer(LocusZoom.RecombinationRateDataLayer).attachToYAxis(2);

    this.addPanel(LocusZoom.GenesPanel)
        .setMargin(20, 20, 20, 50);
    this._panels.genes.addDataLayer(LocusZoom.GenesDataLayer);
  
    return this;
  
};

LocusZoom.DefaultInstance.prototype = new LocusZoom.Instance();

