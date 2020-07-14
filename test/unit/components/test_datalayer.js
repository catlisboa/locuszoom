import {assert} from 'chai';
import * as d3 from 'd3';

import { SCALABLE } from '../../../esm/registry';
import BaseDataLayer from '../../../esm/components/data_layer/base';
import {populate} from '../../../esm/helpers/display';
import DataSources from '../../../esm/data';

/**
 DataLayer.js Tests
 Test composition of the LocusZoom.Panel object and its base classes
 */
describe('LocusZoom.DataLayer', function () {

    describe('Z-index sorting', function () {
        beforeEach(function () {
            const layout = {
                width: 800,
                height: 400,
                panels: [
                    {
                        id: 'panel0', width: 800, proportional_width: 1, height: 400, proportional_height: 1,
                        data_layers: [
                            { id: 'layerA', type: 'line' },
                            { id: 'layerB', type: 'line' },
                            { id: 'layerC', type: 'line' },
                            { id: 'layerD', type: 'line' },
                        ],
                    },
                ],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', null, layout);
        });
        afterEach(function () {
            d3.select('#plot').remove();
            this.plot = null;
        });
        it('should have a chainable method for moving layers up that stops at the top', function () {
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerB', 'layerC', 'layerD']);

            this.plot.panels.panel0.data_layers.layerB.moveUp();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerC', 'layerB', 'layerD']);
            assert.equal(this.plot.panels.panel0.data_layers.layerA.layout.z_index, 0);
            assert.equal(this.plot.panels.panel0.data_layers.layerB.layout.z_index, 2);
            assert.equal(this.plot.panels.panel0.data_layers.layerC.layout.z_index, 1);
            assert.equal(this.plot.panels.panel0.data_layers.layerD.layout.z_index, 3);

            this.plot.panels.panel0.data_layers.layerB.moveUp();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerC', 'layerD', 'layerB']);
            assert.equal(this.plot.panels.panel0.data_layers.layerA.layout.z_index, 0);
            assert.equal(this.plot.panels.panel0.data_layers.layerB.layout.z_index, 3);
            assert.equal(this.plot.panels.panel0.data_layers.layerC.layout.z_index, 1);
            assert.equal(this.plot.panels.panel0.data_layers.layerD.layout.z_index, 2);

            this.plot.panels.panel0.data_layers.layerB.moveUp().moveUp();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerC', 'layerD', 'layerB']);
            assert.equal(this.plot.panels.panel0.data_layers.layerA.layout.z_index, 0);
            assert.equal(this.plot.panels.panel0.data_layers.layerB.layout.z_index, 3);
            assert.equal(this.plot.panels.panel0.data_layers.layerC.layout.z_index, 1);
            assert.equal(this.plot.panels.panel0.data_layers.layerD.layout.z_index, 2);
        });
        it('should have a chainable method for moving layers down that stops at the bottom', function () {
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerB', 'layerC', 'layerD']);

            this.plot.panels.panel0.data_layers.layerC.moveDown();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerA', 'layerC', 'layerB', 'layerD']);
            assert.equal(this.plot.panels.panel0.data_layers.layerA.layout.z_index, 0);
            assert.equal(this.plot.panels.panel0.data_layers.layerB.layout.z_index, 2);
            assert.equal(this.plot.panels.panel0.data_layers.layerC.layout.z_index, 1);
            assert.equal(this.plot.panels.panel0.data_layers.layerD.layout.z_index, 3);

            this.plot.panels.panel0.data_layers.layerC.moveDown();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerC', 'layerA', 'layerB', 'layerD']);
            assert.equal(this.plot.panels.panel0.data_layers.layerA.layout.z_index, 1);
            assert.equal(this.plot.panels.panel0.data_layers.layerB.layout.z_index, 2);
            assert.equal(this.plot.panels.panel0.data_layers.layerC.layout.z_index, 0);
            assert.equal(this.plot.panels.panel0.data_layers.layerD.layout.z_index, 3);

            this.plot.panels.panel0.data_layers.layerC.moveDown().moveDown();
            assert.deepEqual(this.plot.panels.panel0.data_layer_ids_by_z_index, ['layerC', 'layerA', 'layerB', 'layerD']);
            assert.equal(this.plot.panels.panel0.data_layers.layerA.layout.z_index, 1);
            assert.equal(this.plot.panels.panel0.data_layers.layerB.layout.z_index, 2);
            assert.equal(this.plot.panels.panel0.data_layers.layerC.layout.z_index, 0);
            assert.equal(this.plot.panels.panel0.data_layers.layerD.layout.z_index, 3);
        });
    });

    describe('Scalable parameter resolution', function () {
        it('passes numbers and strings directly through regardless of data', function () {
            const datalayer = new BaseDataLayer({ id: 'test' });
            this.layout = { scale: 'foo' };
            assert.equal(datalayer.resolveScalableParameter(this.layout.scale, {}), 'foo');
            assert.equal(datalayer.resolveScalableParameter(this.layout.scale, { foo: 'bar' }), 'foo');
            this.layout = { scale: 17 };
            assert.equal(datalayer.resolveScalableParameter(this.layout.scale, {}), 17);
            assert.equal(datalayer.resolveScalableParameter(this.layout.scale, { foo: 'bar' }), 17);
        });
        it('executes a scale function for the data provided', function () {
            const datalayer = new BaseDataLayer({ id: 'test' });
            const layout = {
                scale: {
                    scale_function: 'categorical_bin',
                    field: 'test',
                    parameters: {
                        categories: ['lion', 'tiger', 'bear'],
                        values: ['dorothy', 'toto', 'scarecrow'],
                    },
                },
            };
            assert.equal(datalayer.resolveScalableParameter(layout.scale, { test: 'lion' }), 'dorothy');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, { test: 'manatee' }), null);
            assert.equal(datalayer.resolveScalableParameter(layout.scale, {}), null);
        });
        it('can operate in a state-aware manner based on index in data[]', function () {
            SCALABLE.add('fake', (parameters, input, index) => index);
            const datalayer = new BaseDataLayer({ id: 'test' });
            const config = { scale_function: 'fake' };
            // The same input value will yield a different scaling function result, because position in data matters.
            assert.equal(datalayer.resolveScalableParameter(config, 'avalue', 0), 0);
            assert.equal(datalayer.resolveScalableParameter(config, 'avalue', 1), 1);

            // Clean up/ deregister scale function when done
            SCALABLE.remove('fake');
        });
        it('supports operating on an entire data element in the absence of a specified field', function () {
            SCALABLE.add('test_effect_direction', function (parameters, input) {
                if (typeof input == 'undefined') {
                    return null;
                } else if ((input.beta && input.beta > 0) || (input.or && input.or > 0)) {
                    return parameters['+'] || null;
                } else if ((input.beta && input.beta < 0) || (input.or && input.or < 0)) {
                    return parameters['-'] || null;
                }
                return null;
            });
            const datalayer = new BaseDataLayer({ id: 'test' });
            const layout = {
                scale: {
                    scale_function: 'test_effect_direction',
                    parameters: {
                        '+': 'triangle-up',
                        '-': 'triangle-down',
                    },
                },
            };
            const variants = [{ beta: 0.5 }, { beta: -0.06 }, { or: -0.34 }, { or: 1.6 }, { foo: 'bar' }];
            assert.equal(datalayer.resolveScalableParameter(layout.scale, variants[0]), 'triangle-up');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, variants[1]), 'triangle-down');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, variants[2]), 'triangle-down');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, variants[3]), 'triangle-up');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, variants[4]), null);

            // Clean up/ deregister scale function when done
            SCALABLE.remove('test_effect_direction');
        });
        it('iterates over an array of options until exhausted or a non-null value is found', function () {
            const datalayer = new BaseDataLayer({ id: 'test' });
            const layout = {
                scale: [
                    {
                        scale_function: 'if',
                        field: 'test',
                        parameters: {
                            field_value: 'wizard',
                            then: 'oz',
                        },
                    },
                    {
                        scale_function: 'categorical_bin',
                        field: 'test',
                        parameters: {
                            categories: ['lion', 'tiger', 'bear'],
                            values: ['dorothy', 'toto', 'scarecrow'],
                        },
                    },
                    'munchkin',
                ],
            };
            assert.equal(datalayer.resolveScalableParameter(layout.scale, { test: 'wizard' }), 'oz');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, { test: 'tiger' }), 'toto');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, { test: 'witch' }), 'munchkin');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, {}), 'munchkin');
        });
        it('can resolve based on an annotation field, even when no point data field by that name is present', function () {
            const layout = {
                id: 'somelayer',
                id_field: 'id',
                scale: [
                    {
                        scale_function: 'if',
                        field: 'custom_field',
                        parameters: { field_value: 'little_dog', then: 'too' },
                    },
                ],
            };
            const datalayer = new BaseDataLayer(layout);
            datalayer.setElementAnnotation('toto', 'custom_field', 'little_dog');
            assert.equal(datalayer.resolveScalableParameter(layout.scale, { id: 'toto' }), 'too');
        });
    });

    describe('Extent generation', function () {
        it('throws an error on invalid axis identifiers', function () {
            const datalayer = new BaseDataLayer({ id: 'test' });
            assert.throws(function() {
                datalayer.getAxisExtent();
            });
            assert.throws(function() {
                datalayer.getAxisExtent('foo');
            });
            assert.throws(function() {
                datalayer.getAxisExtent(1);
            });
            assert.throws(function() {
                datalayer.getAxisExtent('y1');
            });
        });
        it('generates an accurate extent array for arbitrary data sets', function () {
            const layout = {
                id: 'test',
                x_axis: { field: 'x' },
            };
            const datalayer = new BaseDataLayer(layout);

            datalayer.data = [];
            assert.deepEqual(datalayer.getAxisExtent('x'), [], 'No extent is returned if basic criteria cannot be met');

            datalayer.data = [
                { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [1, 4]);

            datalayer.data = [
                { x: 200 }, { x: -73 }, { x: 0 }, { x: 38 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [-73, 200]);

            datalayer.data = [
                { x: 6 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [6, 6]);

            datalayer.data = [
                { x: 'apple' }, { x: 'pear' }, { x: 'orange' },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [undefined, undefined]);
        });
        it('applies upper and lower buffers to extents as defined in the layout', function () {
            let layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    lower_buffer: 0.05,
                },
            };
            let datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [0.85, 4]);
            layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    upper_buffer: 0.2,
                },
            };
            datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 62 }, { x: 7 }, { x: -18 }, { x: 106 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [-18, 130.8]);
            layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    lower_buffer: 0.35,
                    upper_buffer: 0.6,
                },
            };
            datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 95 }, { x: 0 }, { x: -4 }, { x: 256 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [-95, 412]);
        });
        it('applies a minimum extent as defined in the layout', function () {
            let layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    min_extent: [0, 3],
                },
            };
            let datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [0, 4], 'Increase extent exactly to the boundaries when no padding is specified');

            datalayer.data = [];
            assert.deepEqual(datalayer.getAxisExtent('x'), [0, 3], 'If there is no data, use the specified min_extent as given');

            layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    upper_buffer: 0.1,
                    lower_buffer: 0.2,
                    min_extent: [0, 10],
                },
            };
            datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 3 }, { x: 4 }, { x: 5 }, { x: 6 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [0, 10], 'Extent is enforced but no padding applied when data is far from boundary');

            datalayer.data = [
                { x: 0.6 }, { x: 4 }, { x: 5 }, { x: 9 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [-1.08, 10], 'Extent is is enforced and padding is applied when data is close to the lower boundary');

            datalayer.data = [
                { x: 0.4 }, { x: 4 }, { x: 5 }, { x: 9.8 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [-1.48, 10.74], 'Padding is enforced on both sides when data is close to both boundaries');

        });
        it('applies hard floor and ceiling as defined in the layout', function () {
            let layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    min_extent: [6, 10],
                    lower_buffer: 0.5,
                    floor: 0,
                },
            };
            let datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 8 }, { x: 9 }, { x: 8 }, { x: 8.5 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [0, 10]);
            layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    min_extent: [0, 10],
                    upper_buffer: 0.8,
                    ceiling: 5,
                },
            };
            datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 3 }, { x: 4 }, { x: 5 }, { x: 6 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [0, 5]);
            layout = {
                id: 'test',
                x_axis: {
                    field: 'x',
                    min_extent: [0, 10],
                    lower_buffer: 0.8,
                    upper_buffer: 0.8,
                    floor: 4,
                    ceiling: 6,
                },
            };
            datalayer = new BaseDataLayer(layout);
            datalayer.data = [
                { x: 2 }, { x: 4 }, { x: 5 }, { x: 17 },
            ];
            assert.deepEqual(datalayer.getAxisExtent('x'), [4, 6]);
        });

    });

    describe('Layout Parameters', function () {
        beforeEach(function () {
            this.plot = null;
            this.layout = {
                panels: [
                    {
                        id: 'p1',
                        data_layers: [],
                    },
                ],
            };
            d3.select('body').append('div').attr('id', 'plot');
        });
        afterEach(function () {
            d3.select('#plot').remove();
            delete this.plot;
        });
        it('should allow for explicitly setting data layer z_index', function () {
            this.layout.panels[0].data_layers = [
                { id: 'd1', type: 'line', z_index: 1 },
                { id: 'd2', type: 'line', z_index: 0 },
            ];
            this.plot = populate('#plot', null, this.layout);
            assert.deepEqual(this.plot.panels.p1.data_layer_ids_by_z_index, ['d2', 'd1']);
            assert.equal(this.plot.panels.p1.data_layers.d1.layout.z_index, 1);
            assert.equal(this.plot.panels.p1.data_layers.d2.layout.z_index, 0);
        });
        it('should allow for explicitly setting data layer z_index with a negative value', function () {
            this.layout.panels[0].data_layers = [
                { id: 'd1', type: 'line' },
                { id: 'd2', type: 'line' },
                { id: 'd3', type: 'line' },
                { id: 'd4', type: 'line', z_index: -1 },
            ];
            this.plot = populate('#plot', null, this.layout);
            assert.deepEqual(this.plot.panels.p1.data_layer_ids_by_z_index, ['d1', 'd2', 'd4', 'd3']);
            assert.equal(this.plot.panels.p1.data_layers.d1.layout.z_index, 0);
            assert.equal(this.plot.panels.p1.data_layers.d2.layout.z_index, 1);
            assert.equal(this.plot.panels.p1.data_layers.d3.layout.z_index, 3);
            assert.equal(this.plot.panels.p1.data_layers.d4.layout.z_index, 2);
        });
    });

    describe('Layout mutation helpers (public interface)', function () {
        describe('addField', function () {
            beforeEach(function () {
                this.layer = new BaseDataLayer();
            });
            afterEach(function () {
                this.layer = null;
            });

            it('should require field and namespace to be specified', function () {
                // TODO: Should there be validation to ensure this is a known namespace?
                const self = this;
                assert.throws(function () {
                    self.layer.addField();
                }, /Must specify field name and namespace to use when adding field/);

                assert.throws(function () {
                    self.layer.addField('afield');
                }, /Must specify field name and namespace to use when adding field/);
            });

            it('should check type of the transformations argument', function () {
                const self = this;
                assert.ok(
                    this.layer.addField('aman', 'aplan'),
                    'Transformations are optional'
                );
                assert.ok(
                    this.layer.addField('aman', 'aplan', 'acanal'),
                    'Transformation can be a string'
                );
                assert.ok(
                    this.layer.addField('aman', 'aplan', ['acanal', 'panama']),
                    'Transformation can be an array'
                );
                assert.throws(function () {
                    self.layer.addField('aman', 'aplan', 42);
                }, /Must provide transformations as either a string or array of strings/);
            });
            it('should construct an appropriate field name and add it to the internal fields array', function () {
                const e1 = 'namespace:field';
                assert.equal(
                    this.layer.addField('field', 'namespace'),
                    e1
                );

                const e2 = 'namespace:field|transformation';
                assert.equal(
                    this.layer.addField('field', 'namespace', 'transformation'),
                    e2
                );

                const e3 = 'namespace:field|t1|t2';
                assert.equal(
                    this.layer.addField('field', 'namespace', ['t1', 't2']),
                    e3
                );

                const fields = this.layer.layout.fields;
                assert.ok(fields.indexOf(e1) !== -1);
                assert.ok(fields.indexOf(e2) !== -1);
                assert.ok(fields.indexOf(e3) !== -1);
            });
        });
    });

    describe('Highlight functions', function () {
        beforeEach(function () {
            this.plot = null;
            const data_sources = new DataSources()
                .add('d', ['StaticJSON', [{ id: 'a' }, { id: 'b' }, { id: 'c' }]]);
            const layout = {
                panels: [
                    {
                        id: 'p',
                        data_layers: [
                            {
                                id: 'd',
                                fields: ['d:id'],
                                id_field: 'd:id',
                                type: 'scatter',
                                highlighted: { onmouseover: 'toggle' },
                            },
                        ],
                    },
                ],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', data_sources, layout);
        });
        afterEach(function () {
            d3.select('#plot').remove();
            delete this.plot;
        });
        it('should allow for highlighting and unhighlighting a single element', function () {
            return this.plot.lzd.getData({}, ['d:id'])
                .then(() => {
                    const state_id = this.plot.panels.p.data_layers.d.state_id;
                    const layer_state = this.plot.state[state_id];
                    const d = this.plot.panels.p.data_layers.d;
                    const a = d.data[0];
                    const a_id = d.getElementId(a);
                    const b = d.data[1];
                    const c = d.data[2];
                    const c_id = d.getElementId(c);
                    assert.isArray(layer_state.status_flags.highlighted);
                    assert.equal(layer_state.status_flags.highlighted.length, 0);

                    this.plot.panels.p.data_layers.d.highlightElement(a);
                    assert.equal(layer_state.status_flags.highlighted.length, 1);
                    assert.equal(layer_state.status_flags.highlighted[0], a_id);

                    this.plot.panels.p.data_layers.d.unhighlightElement(a);
                    assert.equal(layer_state.status_flags.highlighted.length, 0);

                    this.plot.panels.p.data_layers.d.highlightElement(c);
                    assert.equal(layer_state.status_flags.highlighted.length, 1);
                    assert.equal(layer_state.status_flags.highlighted[0], c_id);

                    this.plot.panels.p.data_layers.d.unhighlightElement(b);
                    assert.equal(layer_state.status_flags.highlighted.length, 1);

                    this.plot.panels.p.data_layers.d.unhighlightElement(c);
                    assert.equal(layer_state.status_flags.highlighted.length, 0);
                });
        });
        it('should allow for highlighting and unhighlighting all elements', function () {
            return this.plot.lzd.getData({}, ['d:id'])
                .then(() => {
                    const state_id = this.plot.panels.p.data_layers.d.state_id;
                    const layer_state = this.plot.state[state_id];
                    const d = this.plot.panels.p.data_layers.d;
                    const a_id = d.getElementId(d.data[0]);
                    const b_id = d.getElementId(d.data[1]);
                    const c_id = d.getElementId(d.data[2]);

                    this.plot.panels.p.data_layers.d.highlightAllElements();
                    assert.equal(layer_state.status_flags.highlighted.length, 3);
                    assert.equal(layer_state.status_flags.highlighted[0], a_id);
                    assert.equal(layer_state.status_flags.highlighted[1], b_id);
                    assert.equal(layer_state.status_flags.highlighted[2], c_id);

                    this.plot.panels.p.data_layers.d.unhighlightAllElements();
                    assert.equal(layer_state.status_flags.highlighted.length, 0);
                });
        });
    });

    describe('Select functions', function () {
        beforeEach(function () {
            this.plot = null;
            const data_sources = new DataSources()
                .add('d', ['StaticJSON', [{ id: 'a' }, { id: 'b' }, { id: 'c' }]]);
            const layout = {
                panels: [
                    {
                        id: 'p',
                        data_layers: [
                            {
                                id: 'd',
                                fields: ['d:id'],
                                id_field: 'd:id',
                                type: 'scatter',
                                selected: { onclick: 'toggle' },
                            },
                        ],
                    },
                ],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', data_sources, layout);
        });
        afterEach(function () {
            d3.select('#plot').remove();
            delete this.plot;
        });
        it('should allow for selecting and unselecting a single element', function () {
            return this.plot.lzd.getData({}, ['d:id'])
                .then(() => {
                    const state_id = this.plot.panels.p.data_layers.d.state_id;
                    const layer_state = this.plot.state[state_id];
                    const d = this.plot.panels.p.data_layers.d;
                    const a = d.data[0];
                    const a_id = d.getElementId(a);
                    const b = d.data[1];
                    const c = d.data[2];
                    const c_id = d.getElementId(c);
                    assert.isArray(layer_state.status_flags.selected);
                    assert.equal(layer_state.status_flags.selected.length, 0);

                    this.plot.panels.p.data_layers.d.selectElement(a);
                    assert.equal(layer_state.status_flags.selected.length, 1);
                    assert.equal(layer_state.status_flags.selected[0], a_id);

                    this.plot.panels.p.data_layers.d.unselectElement(a);
                    assert.equal(layer_state.status_flags.selected.length, 0);

                    this.plot.panels.p.data_layers.d.selectElement(c);
                    assert.equal(layer_state.status_flags.selected.length, 1);
                    assert.equal(layer_state.status_flags.selected[0], c_id);

                    this.plot.panels.p.data_layers.d.unselectElement(b);
                    assert.equal(layer_state.status_flags.selected.length, 1);

                    this.plot.panels.p.data_layers.d.unselectElement(c);
                    assert.equal(layer_state.status_flags.selected.length, 0);
                });
        });
        it('should allow for selecting and unselecting all elements', function () {
            return this.plot.lzd.getData({}, ['d:id'])
                .then(() => {
                    const state_id = this.plot.panels.p.data_layers.d.state_id;
                    const layer_state = this.plot.state[state_id];
                    const d = this.plot.panels.p.data_layers.d;
                    const a_id = d.getElementId(d.data[0]);
                    const b_id = d.getElementId(d.data[1]);
                    const c_id = d.getElementId(d.data[2]);

                    this.plot.panels.p.data_layers.d.selectAllElements();
                    assert.equal(layer_state.status_flags.selected.length, 3);
                    assert.equal(layer_state.status_flags.selected[0], a_id);
                    assert.equal(layer_state.status_flags.selected[1], b_id);
                    assert.equal(layer_state.status_flags.selected[2], c_id);

                    this.plot.panels.p.data_layers.d.unselectAllElements();
                    assert.equal(layer_state.status_flags.selected.length, 0);
                });
        });
    });

    describe('Tool tip functions', function () {
        beforeEach(function () {
            this.plot = null;
            this.layout = {
                panels: [
                    {
                        id: 'p',
                        data_layers: [
                            {
                                id: 'd',
                                type: 'scatter',
                                tooltip: {
                                    closable: true,
                                    show: { or: ['highlighted', 'selected'] },
                                    hide: { and: ['unhighlighted', 'unselected'] },
                                    html: 'foo',
                                },
                                behaviors: { onclick: [{ action: 'toggle', status: 'selected', exclusive: true }] },
                            },
                        ],
                    },
                ],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', null, this.layout);
        });
        afterEach(function () {
            d3.select('#plot').remove();
            delete this.plot;
        });
        it('should allow for creating and destroying tool tips', function () {
            this.plot.panels.p.data_layers.d.data = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
            this.plot.panels.p.data_layers.d.positionTooltip = function () {
                return 0;
            };
            const a = this.plot.panels.p.data_layers.d.data[0];
            const a_id = this.plot.panels.p.data_layers.d.getElementId(a);
            const a_id_q = `#${  (`${a_id  }-tooltip`).replace(/(:|\.|\[|\]|,)/g, '\\$1')}`;
            assert.equal(Object.keys(this.plot.panels.p.data_layers.d.tooltips).length, 0);

            this.plot.panels.p.data_layers.d.createTooltip(a);
            assert.isObject(this.plot.panels.p.data_layers.d.tooltips[a_id]);
            assert.equal(Object.keys(this.plot.panels.p.data_layers.d.tooltips).length, 1);
            assert.equal(d3.select(a_id_q).empty(), false);

            this.plot.panels.p.data_layers.d.destroyTooltip(a_id);
            assert.equal(Object.keys(this.plot.panels.p.data_layers.d.tooltips).length, 0);
            assert.equal(typeof this.plot.panels.p.data_layers.d.tooltips[a_id], 'undefined');
            assert.equal(d3.select(a_id_q).empty(), true);
        });
        it('should allow for showing or hiding a tool tip based on layout directives and element status', function () {
            this.plot.panels.p.data_layers.d.data = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
            this.plot.panels.p.data_layers.d.positionTooltip = function () {
                return 0;
            };
            const d = this.plot.panels.p.data_layers.d;
            const a = d.data[0];
            const a_id = d.getElementId(a);
            const b = d.data[1];
            const b_id = d.getElementId(b);
            // Make sure the tooltips object is there
            assert.isObject(d.tooltips);
            // Test highlighted OR selected
            assert.isUndefined(d.tooltips[a_id]);

            d.highlightElement(a);
            assert.isObject(d.tooltips[a_id]);

            d.unhighlightElement(a);
            assert.isUndefined(d.tooltips[a_id]);

            d.selectElement(a);
            assert.isObject(d.tooltips[a_id]);

            d.unselectElement(a);
            assert.isUndefined(d.tooltips[a_id]);
            // Test highlight AND selected
            assert.isUndefined(d.tooltips[b_id]);

            d.highlightElement(b);
            d.selectElement(b);
            assert.isObject(d.tooltips[b_id]);

            d.unhighlightElement(b);
            d.unselectElement(b);
            assert.isUndefined(d.tooltips[b_id]);
        });

        it('should allow tooltip open/close state to be tracked separately from element selection', function () {
            // Regression test for zombie tooltips returning after re-render
            const layer = this.plot.panels.p.data_layers.d;
            const status_flags = layer.layer_state.status_flags;

            const item_a = { id: 'a' };
            const internal_id = layer.getElementId(item_a);

            layer.data = [item_a, { id: 'b' }, { id: 'c' }];
            layer.positionTooltip = function () {
                return 0;
            }; // Override for unit testing

            // Select a point (which will create a tooltip due to element status). Then close tooltip and re-render.
            //  Confirm state is tracked and tooltip does not magically return.
            const self = this;
            return self.plot.applyState().then(function () { // Render initially so that plot is set up right
                layer.setElementStatus('selected', item_a, true, true);
                const internal_id = layer.getElementId(item_a);

                assert.ok(layer.tooltips[internal_id], 'Tooltip created on selection');
                assert.ok(status_flags['selected'].includes(internal_id), 'Item was initially selected');

                layer.destroyTooltip(item_a);
                assert.ok(!layer.tooltips[internal_id], 'Tooltip was destroyed by user close event');

                assert.ok(status_flags['selected'].includes(internal_id), 'Point remains selected after closing tooltip');
                assert.ok(!status_flags['has_tooltip'].includes(internal_id), 'Tooltip was destroyed by user close event');

                return self.plot.applyState();
            }).then(function () { // Force a re-render to see if zombie items remain
                assert.ok(status_flags['selected'].includes(internal_id), 'Point remains selected after re-render');
                assert.ok(!status_flags['has_tooltip'].includes(internal_id), 'Tooltip remains destroyed after re-render');
            });
        });
    });

    describe('Persistent annotations', function () {
        beforeEach(function () {
            this.plot = null;
            const data_sources = new DataSources()
                .add('d', ['StaticJSON', [{ id: 'a' }, { id: 'b', some_field: true }, { id: 'c' }]]);
            const layout = {
                panels: [
                    {
                        id: 'p',
                        data_layers: [
                            {
                                id: 'd',
                                fields: ['d:id', 'd:some_field'],
                                id_field: 'd:id',
                                type: 'scatter',
                                selected: { onclick: 'toggle' },
                                label: {
                                    text: 'd:id',
                                    filters: [{ field: 'custom_field', operator: '=', value: true }],
                                },
                            },
                        ],
                    },
                ],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', data_sources, layout);
        });

        it('can store user-defined marks for points that persist across re-renders', function () {
            const data_layer = this.plot.panels.p.data_layers.d;
            // Set the annotation for a point with id value of "a"
            data_layer.setElementAnnotation('a', 'custom_field', 'some_value');

            // Find the element annotation for this point via several different ways
            assert.equal(data_layer.layer_state.extra_fields['plot_p_d-a']['custom_field'], 'some_value', 'Found in internal storage (as elementID)');
            assert.equal(data_layer.getElementAnnotation('a', 'custom_field'), 'some_value', 'Found via helper method (from id_field)');
            assert.equal(data_layer.getElementAnnotation('b', 'custom_field'), null, 'If no annotation found, returns null. Annotation does not return actual field values.');
            assert.equal(data_layer.getElementAnnotation({'d:id': 'a'}, 'custom_field'), 'some_value', 'Found via helper method (as data object)');

            return this.plot.applyState().then(function() {
                assert.equal(data_layer.getElementAnnotation('a', 'custom_field'), 'some_value', 'Annotations persist across renderings');
            });
        });

        it('can use custom markings in layout directives', function () {
            const self = this;
            const data_layer = this.plot.panels.p.data_layers.d;
            assert.equal(data_layer.label_groups, undefined, 'No labels on first render');
            data_layer.setElementAnnotation('a', 'custom_field', true);

            return this.plot.applyState().then(function () {
                assert.equal(data_layer.label_groups.size(), 1, 'Labels are drawn because of annotations');
                // After turning labels on, confirm that we can cycle them off and influence rendering
                data_layer.setElementAnnotation('a', 'custom_field', false);
                return self.plot.applyState();
            }).then(function () {
                assert.equal(data_layer.label_groups.size(), 0, 'Labels are removed because of annotations');
            });
        });

        it('gives precedence to real data fields when an annotation exists with the same name', function () {
            const self = this;
            const data_layer = this.plot.panels.p.data_layers.d;
            data_layer.layout.label.filters[0].field = 'd:some_field';

            // Rerender once so the modified layout takes effect
            return this.plot.applyState().then(function () {
                assert.equal(data_layer.label_groups.size(), 1, 'Labels are drawn on first render because field value says to');
                // Introduce an annotation that conflicts with the data field from the API
                data_layer.setElementAnnotation('b', 'd:some_field', false);
                return self.plot.applyState();
            }).then(function () {
                assert.equal(data_layer.label_groups.size(), 1, 'Real fields says to label, annotation says no. Real field wins.');
            });
        });
    });
});