import * as d3 from 'd3';
import BaseDataLayer from './base';
import {applyStyles} from '../../helpers/common';
import {parseFields} from '../../helpers/display';
import {merge, nameToSymbol} from '../../helpers/layouts';
import {coalesce_scatter_points} from '../../helpers/render';

/**
 * @memberof module:LocusZoom_DataLayers~scatter
 */
const default_layout = {
    point_size: 40,
    point_shape: 'circle',
    tooltip_positioning: 'horizontal',
    color: '#888888',
    coalesce: {
        active: false,
        max_points: 800, // Many plots are 800-2400 px wide, so, more than 1 datum per pixel of average region width
        // Define the "region of interest", like "bottom half of plot"; any points outside this region are taken as is
        //   Values are expressed in terms of data value and will be converted to pixels internally.
        x_min: '-Infinity',  // JSON doesn't handle some valid JS numbers. Kids, don't get a career in computers.
        x_max: 'Infinity',
        y_min: 0,
        y_max: 3.0,
        x_gap: 7,
        y_gap: 7,
    },
    fill_opacity: 1,
    y_axis: {
        axis: 1,
    },
    id_field: 'id',
};

/**
 * Options that control point-coalescing in scatter plots
 * @typedef {object} module:LocusZoom_DataLayers~scatter~coalesce_options
 * @property {boolean} [active=false] Whether to use this feature. Typically used for GWAS plots, but
 *   not other scatter plots such as PheWAS.
 * @property {number} [max_points=800] Only attempt to reduce DOM size if there are at least this many
 *  points. Many plots are 800-2400 px wide, so, more than 1 datum per pixel of average region width. For more
 *  sparse datasets, all points will be faithfully rendered even if coalesce.active=true.
 * @property {number} [x_min='-Infinity'] Min x coordinate of the region where points will be coalesced
 * @property {number} [x_max='Infinity'] Max x coordinate of the region where points will be coalesced
 * @property {number} [y_min=0] Min y coordinate of the region where points will be coalesced.
 * @property {number} [y_max=3.0] Max y coordinate of the region where points will be coalesced
 * @property {number} [x_gap=7] Max number of pixels between the center of two points that can be
 *   coalesced. For circles, area 40 = radius ~3.5; aim for ~1 diameter distance.
 * @property {number} [y_gap=7]
 */

/**
 * Scatter Data Layer
 * Implements a standard scatter plot
 * @alias module:LocusZoom_DataLayers~scatter
 */
class Scatter extends BaseDataLayer {
    /**
     * @param {number|module:LocusZoom_DataLayers~ScalableParameter[]} [layout.point_size=40] The size (area) of the point for each datum
     * @param {string|module:LocusZoom_DataLayers~ScalableParameter[]} [layout.point_shape='circle'] Shape of the point for each datum. Supported values map to the d3 SVG Symbol Types (i.e.: "circle", "cross", "diamond", "square", "triangle", "star", and "wye"), plus "triangledown".
     * @param {string|module:LocusZoom_DataLayers~ScalableParameter[]} [layout.color='#888888'] The color of the point for each datum
     * @param {module:LocusZoom_DataLayers~scatter~coalesce_options} [layout.coalesce] Options to control whether and how to combine adjacent insignificant ("within region of interest") points
     *   to improve rendering performance. These options are primarily aimed at GWAS region plots. Within a specified
     *   rectangle area (eg "insignificant point cutoff"), we choose only points far enough part to be seen.
     *   The defaults are specifically tuned for GWAS plots with -log(p) on the y-axis.
     * @param {number|module:LocusZoom_DataLayers~ScalableParameter[]} [layout.fill_opacity=1] Opacity (0..1) for each datum point
     * @param {string} [layout.label.text] Similar to tooltips: a template string that can reference datum fields for label text.
     * @param {number} [layout.label.spacing] Distance (in px) between the label and the center of the datum.
     * @param {object} [layout.label.lines.style] CSS style options for how the line is rendered
     * @param {number} [layout.label.filters] Filters that describe which points to label. For performance reasons,
     *   we recommend labeling only a small subset of most interesting points.
     * @param {object} [layout.label.style] CSS style options for label text
     */
    constructor(layout) {
        layout = merge(layout, default_layout);

        // Extra default for layout spacing
        // Not in default layout since that would make the label attribute always present
        if (layout.label && isNaN(layout.label.spacing)) {
            layout.label.spacing = 4;
        }
        super(...arguments);
    }

    // Implement tooltip position to be layer-specific
    _getTooltipPosition(tooltip) {
        const x_center = this.parent.x_scale(tooltip.data[this.layout.x_axis.field]);
        const y_scale = `y${this.layout.y_axis.axis}_scale`;
        const y_center = this.parent[y_scale](tooltip.data[this.layout.y_axis.field]);
        const point_size = this.resolveScalableParameter(this.layout.point_size, tooltip.data);
        const offset = Math.sqrt(point_size / Math.PI);

        return {
            x_min: x_center - offset, x_max: x_center + offset,
            y_min: y_center - offset, y_max: y_center + offset,
        };
    }

    // Function to flip labels from being anchored at the start of the text to the end
    // Both to keep labels from running outside the data layer and  also as a first
    // pass on recursive separation
    flip_labels() {
        const data_layer = this;
        // Base positions on the default point size (which is what resolve scalable param returns if no data provided)
        const point_size = data_layer.resolveScalableParameter(data_layer.layout.point_size, {});
        const spacing = data_layer.layout.label.spacing;
        const handle_lines = Boolean(data_layer.layout.label.lines);
        const min_x = 2 * spacing;
        const max_x = this.parent_plot.layout.width - this.parent.layout.margin.left - this.parent.layout.margin.right - (2 * spacing);

        const flip = (dn, dnl) => {
            const dnx = +dn.attr('x');
            const text_swing = (2 * spacing) + (2 * Math.sqrt(point_size));
            let dnlx2;
            let line_swing;
            if (handle_lines) {
                dnlx2 = +dnl.attr('x2');
                line_swing = spacing + (2 * Math.sqrt(point_size));
            }
            if (dn.style('text-anchor') === 'start') {
                dn.style('text-anchor', 'end');
                dn.attr('x', dnx - text_swing);
                if (handle_lines) {
                    dnl.attr('x2', dnlx2 - line_swing);
                }
            } else {
                dn.style('text-anchor', 'start');
                dn.attr('x', dnx + text_swing);
                if (handle_lines) {
                    dnl.attr('x2', dnlx2 + line_swing);
                }
            }
        };
        // Flip any going over the right edge from the right side to the left side
        // (all labels start on the right side)
        data_layer.label_texts.each(function (d, i) {
            const a = this;
            const da = d3.select(a);
            const dax = +da.attr('x');
            const abound = da.node().getBoundingClientRect();
            if (dax + abound.width + spacing > max_x) {
                const dal = handle_lines ? d3.select(data_layer.label_lines.nodes()[i]) : null;
                flip(da, dal);
            }
        });
        // Second pass to flip any others that haven't flipped yet if they collide with another label
        data_layer.label_texts.each(function (d, i) {
            const a = this;
            const da = d3.select(a);
            if (da.style('text-anchor') === 'end') {
                return;
            }
            let dax = +da.attr('x');
            const abound = da.node().getBoundingClientRect();
            const dal = handle_lines ? d3.select(data_layer.label_lines.nodes()[i]) : null;
            data_layer.label_texts.each(function () {
                const b = this;
                const db = d3.select(b);
                const bbound = db.node().getBoundingClientRect();
                const collision = abound.left < bbound.left + bbound.width + (2 * spacing) &&
                    abound.left + abound.width + (2 * spacing) > bbound.left &&
                    abound.top < bbound.top + bbound.height + (2 * spacing) &&
                    abound.height + abound.top + (2 * spacing) > bbound.top;
                if (collision) {
                    flip(da, dal);
                    // Double check that this flip didn't push the label past min_x. If it did, immediately flip back.
                    dax = +da.attr('x');
                    if (dax - abound.width - spacing < min_x) {
                        flip(da, dal);
                    }
                }
            });
        });
    }

    // Recursive function to space labels apart immediately after initial render
    // Adapted from thudfactor's fiddle here: https://jsfiddle.net/thudfactor/HdwTH/
    // TODO: Make labels also aware of data elements
    separate_labels() {
        this.seperate_iterations++;
        const data_layer = this;
        const alpha = 0.5;
        if (!this.layout.label) {
            // Guard against layout changing in the midst of iterative rerender
            return;
        }
        const spacing = this.layout.label.spacing;
        let again = false;
        data_layer.label_texts.each(function () {
            // TODO: O(n2) algorithm; revisit performance?
            const a = this;
            const da = d3.select(a);
            const y1 = da.attr('y');
            data_layer.label_texts.each(function () {
                const b = this;
                // a & b are the same element and don't collide.
                if (a === b) {
                    return;
                }
                const db = d3.select(b);
                // a & b are on opposite sides of the chart and
                // don't collide
                if (da.attr('text-anchor') !== db.attr('text-anchor')) {
                    return;
                }
                // Determine if the  bounding rects for the two text elements collide
                const abound = da.node().getBoundingClientRect();
                const bbound = db.node().getBoundingClientRect();
                const collision = abound.left < bbound.left + bbound.width + (2 * spacing) &&
                    abound.left + abound.width + (2 * spacing) > bbound.left &&
                    abound.top < bbound.top + bbound.height + (2 * spacing) &&
                    abound.height + abound.top + (2 * spacing) > bbound.top;
                if (!collision) {
                    return;
                }
                again = true;
                // If the labels collide, we'll push each
                // of the two labels up and down a little bit.
                const y2 = db.attr('y');
                const sign = abound.top < bbound.top ? 1 : -1;
                const adjust = sign * alpha;
                let new_a_y = +y1 - adjust;
                let new_b_y = +y2 + adjust;
                // Keep new values from extending outside the data layer
                const min_y = 2 * spacing;
                const max_y = data_layer.parent.layout.height - data_layer.parent.layout.margin.top - data_layer.parent.layout.margin.bottom - (2 * spacing);
                let delta;
                if (new_a_y - (abound.height / 2) < min_y) {
                    delta = +y1 - new_a_y;
                    new_a_y = +y1;
                    new_b_y += delta;
                } else if (new_b_y - (bbound.height / 2) < min_y) {
                    delta = +y2 - new_b_y;
                    new_b_y = +y2;
                    new_a_y += delta;
                }
                if (new_a_y + (abound.height / 2) > max_y) {
                    delta = new_a_y - +y1;
                    new_a_y = +y1;
                    new_b_y -= delta;
                } else if (new_b_y + (bbound.height / 2) > max_y) {
                    delta = new_b_y - +y2;
                    new_b_y = +y2;
                    new_a_y -= delta;
                }
                da.attr('y', new_a_y);
                db.attr('y', new_b_y);
            });
        });
        if (again) {
            // Adjust lines to follow the labels
            if (data_layer.layout.label.lines) {
                const label_elements = data_layer.label_texts.nodes();
                data_layer.label_lines.attr('y2', (d, i) => {
                    const label_line = d3.select(label_elements[i]);
                    return label_line.attr('y');
                });
            }
            // After ~150 iterations we're probably beyond diminising returns, so stop recursing
            if (this.seperate_iterations < 150) {
                setTimeout(() => {
                    this.separate_labels();
                }, 1);
            }
        }
    }

    // Implement the main render function
    render() {
        const data_layer = this;
        const x_scale = this.parent['x_scale'];
        const y_scale = this.parent[`y${this.layout.y_axis.axis}_scale`];

        const xcs = Symbol.for('lzX');
        const ycs = Symbol.for('lzY');

        // Apply filters to only render a specified set of points
        let track_data = this._applyFilters();

        // Add coordinates before rendering, so we can coalesce
        track_data.forEach((item) => {
            let x = x_scale(item[this.layout.x_axis.field]);
            let y = y_scale(item[this.layout.y_axis.field]);
            if (isNaN(x)) {
                x = -1000;
            }
            if (isNaN(y)) {
                y = -1000;
            }
            item[xcs] = x;
            item[ycs] = y;
        });

        if (this.layout.coalesce.active && track_data.length > this.layout.coalesce.max_points) {
            let { x_min, x_max, y_min, y_max, x_gap, y_gap } = this.layout.coalesce;
            // Convert x and y "significant region" range from data values to pixels
            const x_min_px = isFinite(x_min) ? x_scale(+x_min) : -Infinity;
            const x_max_px = isFinite(x_max) ? x_scale(+x_max) : Infinity;
            // For y px, we flip the data min/max b/c in SVG coord system +y is down: smaller data y = larger px y
            const y_min_px = isFinite(y_max) ? y_scale(+y_max) : -Infinity;
            const y_max_px = isFinite(y_min) ? y_scale(+y_min) : Infinity;
            track_data = coalesce_scatter_points(track_data, x_min_px, x_max_px, x_gap, y_min_px, y_max_px, y_gap);
        }

        if (this.layout.label) {
            let label_data;
            const filters = data_layer.layout.label.filters || [];
            if (!filters.length) {
                label_data = track_data;
            } else {
                const func = this.filter.bind(this, filters);
                label_data = track_data.filter(func);
            }

            // Render label groups
            this.label_groups = this.svg.group
                .selectAll(`g.lz-data_layer-${this.layout.type}-label`)
                .data(label_data, (d) => `${d[this.layout.id_field]}_label`);

            const style_class = `lz-data_layer-${this.layout.type}-label`;
            const groups_enter = this.label_groups.enter()
                .append('g')
                .attr('class', style_class);

            if (this.label_texts) {
                this.label_texts.remove();
            }

            this.label_texts = this.label_groups.merge(groups_enter)
                .append('text')
                .text((d) => parseFields(data_layer.layout.label.text || '', d, this.getElementAnnotation(d)))
                .attr('x', (d) => {
                    return d[xcs]
                        + Math.sqrt(data_layer.resolveScalableParameter(data_layer.layout.point_size, d))
                        + data_layer.layout.label.spacing;
                })
                .attr('y', (d) => d[ycs])
                .attr('text-anchor', 'start')
                .call(applyStyles, data_layer.layout.label.style || {});

            // Render label lines
            if (data_layer.layout.label.lines) {
                if (this.label_lines) {
                    this.label_lines.remove();
                }
                this.label_lines = this.label_groups.merge(groups_enter)
                    .append('line')
                    .attr('x1', (d) => d[xcs])
                    .attr('y1', (d) => d[ycs])
                    .attr('x2', (d) => {
                        return d[xcs]
                            + Math.sqrt(data_layer.resolveScalableParameter(data_layer.layout.point_size, d))
                            + (data_layer.layout.label.spacing / 2);
                    })
                    .attr('y2', (d) => d[ycs])
                    .call(applyStyles, data_layer.layout.label.lines.style || {});
            }
            // Remove labels when they're no longer in the filtered data set
            this.label_groups.exit()
                .remove();
        } else {
            // If the layout definition has changed (& no longer specifies labels), strip any previously rendered
            if (this.label_texts) {
                this.label_texts.remove();
            }
            if (this.label_lines) {
                this.label_lines.remove();
            }
            if (this.label_groups) {
                this.label_groups.remove();
            }
        }

        // Generate main scatter data elements
        const selection = this.svg.group
            .selectAll(`path.lz-data_layer-${this.layout.type}`)
            .data(track_data, (d) => d[this.layout.id_field]);

        // Create elements, apply class, ID, and initial position
        // Generate new values (or functions for them) for position, color, size, and shape
        const transform = (d) => `translate(${d[xcs]}, ${d[ycs]})`;

        const shape = d3.symbol()
            .size((d, i) => this.resolveScalableParameter(this.layout.point_size, d, i))
            .type((d, i) => nameToSymbol(this.resolveScalableParameter(this.layout.point_shape, d, i)));

        const style_class = `lz-data_layer-${this.layout.type}`;
        selection.enter()
            .append('path')
            .attr('class', style_class)
            .attr('id', (d) => this.getElementId(d))
            .merge(selection)
            .attr('transform', transform)
            .attr('fill', (d, i) => this.resolveScalableParameter(this.layout.color, d, i))
            .attr('fill-opacity', (d, i) => this.resolveScalableParameter(this.layout.fill_opacity, d, i))
            .attr('d', shape);

        // Remove old elements as needed
        selection.exit()
            .remove();

        // Apply method to keep labels from overlapping each other
        if (this.layout.label) {
            this.flip_labels();
            this.seperate_iterations = 0;
            this.separate_labels();
        }

        // Apply default event emitters & mouse behaviors. Apply to the container, not per element,
        // to reduce number of event listeners. These events will apply to both scatter points and labels.
        this.svg.group
            .on('click.event_emitter', () => {
                // D3 doesn't natively support bubbling very well; we need to find the data for the bubbled event
                const item_data = d3.select(d3.event.target).datum();
                this.parent.emit('element_clicked', item_data, true);
            })
            .call(this.applyBehaviors.bind(this));
    }

    /**
     * A new LD reference variant has been selected (usually by clicking within a GWAS scatter plot)
     *   This event only fires for manually selected variants. It does not fire if the LD reference variant is
     *   automatically selected (eg by choosing the most significant hit in the region)
     * @event set_ldrefvar
     * @property {object} data { ldrefvar } The variant identifier of the LD reference variant
     * @see event:any_lz_event
     */

    /**
     * Method to set a passed element as the LD reference variant in the plot-level state. Triggers a re-render
     *   so that the plot will update with the new LD information.
     * This is useful in tooltips, eg the "make LD reference" action link for GWAS scatter plots.
     * @param {object} element The data associated with a particular plot element
     * @fires event:set_ldrefvar
     * @return {Promise}
      */
    makeLDReference(element) {
        let ref = null;
        if (typeof element == 'undefined') {
            throw new Error('makeLDReference requires one argument of any type');
        } else if (typeof element == 'object') {
            if (this.layout.id_field && typeof element[this.layout.id_field] != 'undefined') {
                ref = element[this.layout.id_field].toString();
            } else if (typeof element['id'] != 'undefined') {
                ref = element['id'].toString();
            } else {
                ref = element.toString();
            }
        } else {
            ref = element.toString();
        }
        this.parent.emit('set_ldrefvar', { ldrefvar: ref }, true);
        return this.parent_plot.applyState({ ldrefvar: ref });
    }
}

/**
 * A scatter plot in which the x-axis represents categories, rather than individual positions.
 * For example, this can be used by PheWAS plots to show related groups. This plot allows the categories and color options to be
 *   determined dynamically when data is first loaded.
 * @alias module:LocusZoom_DataLayers~category_scatter
 */
class CategoryScatter extends Scatter {
    /**
     * @param {string} layout.x_axis.category_field The datum field to use in auto-generating tick marks, color scheme, and point ordering.
     */
    constructor(layout) {
        super(...arguments);
        /**
         * Define category names and extents (boundaries) for plotting.
         * In the form {category_name: [min_x, max_x]}
         * @private
         * @member {Object.<String, Number[]>}
         */
        this._categories = {};
    }

    /**
     * This plot layer makes certain assumptions about the data passed in. Transform the raw array of records from
     *   the datasource to prepare it for plotting, as follows:
     * 1. The scatter plot assumes that all records are given in sequence (pre-grouped by `category_field`)
     * 2. It assumes that all records have an x coordinate for individual plotting
     * @private
     */
    _prepareData() {
        const xField = this.layout.x_axis.field || 'x';
        // The (namespaced) field from `this.data` that will be used to assign datapoints to a given category & color
        const category_field = this.layout.x_axis.category_field;
        if (!category_field) {
            throw new Error(`Layout for ${this.layout.id} must specify category_field`);
        }
        // Sort the data so that things in the same category are adjacent (case-insensitive by specified field)
        const sourceData = this.data
            .sort((a, b) => {
                const ak = a[category_field];
                const bk = b[category_field];
                const av = (typeof ak === 'string') ? ak.toLowerCase() : ak;
                const bv = (typeof bk === 'string') ? bk.toLowerCase() : bk;
                return (av === bv) ? 0 : (av < bv ? -1 : 1);
            });
        sourceData.forEach((d, i) => {
            // Implementation detail: Scatter plot requires specifying an x-axis value, and most datasources do not
            //   specify plotting positions. If a point is missing this field, fill in a synthetic value.
            d[xField] = d[xField] || i;
        });
        return sourceData;
    }

    /**
     * Identify the unique categories on the plot, and update the layout with an appropriate color scheme.
     * Also identify the min and max x value associated with the category, which will be used to generate ticks
     * @private
     * @returns {Object.<String, Number[]>} Series of entries used to build category name ticks {category_name: [min_x, max_x]}
     */
    _generateCategoryBounds() {
        // TODO: API may return null values in category_field; should we add placeholder category label?
        // The (namespaced) field from `this.data` that will be used to assign datapoints to a given category & color
        const category_field = this.layout.x_axis.category_field;
        const xField = this.layout.x_axis.field || 'x';
        const uniqueCategories = {};
        this.data.forEach((item) => {
            const category = item[category_field];
            const x = item[xField];
            const bounds = uniqueCategories[category] || [x, x];
            uniqueCategories[category] = [Math.min(bounds[0], x), Math.max(bounds[1], x)];
        });

        const categoryNames = Object.keys(uniqueCategories);
        this._setDynamicColorScheme(categoryNames);

        return uniqueCategories;
    }

    /**
     * This layer relies on defining its own category-based color scheme. Find the correct color config object to
     *  be modified.
     * @param [from_source]
     * @returns {Object} A mutable reference to the layout configuration object
     * @private
     */
    _getColorScale(from_source) {
        from_source = from_source || this.layout;
        // If the layout does not use a supported coloring scheme, or is already complete, this method should do nothing

        // For legacy reasons, layouts can specify color as an object (only one way to set color), as opposed to the
        //  preferred mechanism of array (multiple coloring options)
        let color_params = from_source.color || []; // Object or scalar, no other options allowed
        if (Array.isArray(color_params)) {
            color_params = color_params.find((item) => item.scale_function === 'categorical_bin');
        }
        if (!color_params || color_params.scale_function !== 'categorical_bin') {
            throw new Error('This layer requires that color options be provided as a `categorical_bin`');
        }
        return color_params;
    }

    /**
     * Automatically define a color scheme for the layer based on data returned from the server.
     *   If part of the color scheme has been specified, it will fill in remaining missing information.
     *
     * There are three scenarios:
     * 1. The layout does not specify either category names or (color) values. Dynamically build both based on
     *    the data and update the layout.
     * 2. The layout specifies colors, but not categories. Use that exact color information provided, and dynamically
     *     determine what categories are present in the data. (cycle through the available colors, reusing if there
     *     are a lot of categories)
     * 3. The layout specifies exactly what colors and categories to use (and they match the data!). This is useful to
     *    specify an explicit mapping between color scheme and category names, when you want to be sure that the
     *    plot matches a standard color scheme.
     *    (If the layout specifies categories that do not match the data, the user specified categories will be ignored)
     *
     * This method will only act if the layout defines a `categorical_bin` scale function for coloring. It may be
     *   overridden in a subclass to suit other types of coloring methods.
     *
     * @param {String[]} categoryNames
     * @private
     */
    _setDynamicColorScheme(categoryNames) {
        const colorParams = this._getColorScale(this.layout).parameters;
        const baseParams = this._getColorScale(this._base_layout).parameters;

        if (baseParams.categories.length && baseParams.values.length) {
            // If there are preset category/color combos, make sure that they apply to the actual dataset
            const parameters_categories_hash = {};
            baseParams.categories.forEach((category) => {
                parameters_categories_hash[category] = 1;
            });
            if (categoryNames.every((name) => Object.prototype.hasOwnProperty.call(parameters_categories_hash, name))) {
                // The layout doesn't have to specify categories in order, but make sure they are all there
                colorParams.categories = baseParams.categories;
            } else {
                colorParams.categories = categoryNames;
            }
        } else {
            colorParams.categories = categoryNames;
        }
        // Prefer user-specified colors if provided. Make sure that there are enough colors for all the categories.
        let colors;
        if (baseParams.values.length) {
            colors = baseParams.values;
        } else {
            // Originally from d3v3 category20
            colors = ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5'];
        }
        while (colors.length < categoryNames.length) {
            colors = colors.concat(colors);
        }
        colors = colors.slice(0, categoryNames.length);  // List of hex values, should be of same length as categories array
        colorParams.values = colors;
    }

    /**
     *
     * @param dimension
     * @param {Object} [config] Parameters that customize how ticks are calculated (not style)
     * @param {('left'|'center'|'right')} [config.position='left'] Align ticks with the center or edge of category
     * @returns {Array}
     */
    getTicks(dimension, config) { // Overrides parent method
        if (!['x', 'y1', 'y2'].includes(dimension)) {
            throw new Error('Invalid dimension identifier');
        }
        const position = config.position || 'left';
        if (!['left', 'center', 'right'].includes(position)) {
            throw new Error('Invalid tick position');
        }

        const categoryBounds = this._categories;
        if (!categoryBounds || !Object.keys(categoryBounds).length) {
            return [];
        }

        if (dimension === 'y') {
            return [];
        }

        if (dimension === 'x') {
            // If colors have been defined by this layer, use them to make tick colors match scatterplot point colors
            const colors = this._getColorScale(this.layout);
            const knownCategories = colors.parameters.categories || [];
            const knownColors = colors.parameters.values || [];

            return Object.keys(categoryBounds).map((category, index) => {
                const bounds = categoryBounds[category];
                let xPos;

                switch (position) {
                case 'left':
                    xPos = bounds[0];
                    break;
                case 'center':
                    // Center tick under one or many elements as appropriate
                    // eslint-disable-next-line no-case-declarations
                    const diff = bounds[1] - bounds[0];
                    xPos = bounds[0] + (diff !== 0 ? diff : bounds[0]) / 2;
                    break;
                case 'right':
                    xPos = bounds[1];
                    break;
                }
                return {
                    x: xPos,
                    text: category,
                    style: {
                        'fill': knownColors[knownCategories.indexOf(category)] || '#000000',
                    },
                };
            });
        }
    }

    applyCustomDataMethods() {
        this.data = this._prepareData();
        this._categories = this._generateCategoryBounds();
        return this;
    }
}


export { Scatter as scatter, CategoryScatter as category_scatter };
