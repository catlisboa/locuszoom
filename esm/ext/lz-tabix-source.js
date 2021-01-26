/**
 * A datasource that fetches data from a remote Tabix file, instead of a RESTful API.
 * Requires a generic user-specified parser function.
 *
 * ### Features provided
 * * {@link module:LocusZoom_Adapters~TabixUrlSource}
 *
 * ### Loading and usage
 * The page must incorporate and load all libraries before this file can be used, including:
 * - Vendor assets
 * - LocusZoom
 * - tabix-reader (available via NPM or a related CDN)
 *
 * To use in an environment without special JS build tooling, simply load the extension file as JS from a CDN:
 * ```
 * <script src="https://cdn.jsdelivr.net/npm/locuszoom@INSERT_VERSION_HERE/dist/ext/lz-tabix-source.min.js" type="application/javascript"></script>
 * ```
 *
 * To use with ES6 modules, the plugin must be loaded and registered explicitly before use:
 * ```
 * import LocusZoom from 'locuszoom';
 * import LzTabixSource from 'locuszoom/esm/ext/lz-tabix-source';
 * LocusZoom.use(LzTabixSource);
 * ```
 *
 * Then use the layouts made available by this extension. (see demos and documentation for guidance)
 *
 *
 * @module
 */
import tabix from 'tabix-reader';


function install(LocusZoom) {
    const BaseAdapter = LocusZoom.Adapters.get('BaseAdapter');

    /**
     * Loads data from a remote Tabix file (if the file host has been configured with proper
     *  CORS and Range header support). For instructions on how to configure a remote file host such as S3 or
     *  Google Cloud storage to serve files in the manner required, see:
     *  https://docs.cancergenomicscloud.org/docs/enabling-cross-origin-resource-sharing-cors#CORS
     *
     * @alias module:LocusZoom_Adapters~TabixUrlSource
     * @see {@link module:ext/lz-tabix-source} for required extension and installation instructions
     * @see module:LocusZoom_Adapters~BaseApiAdapter
     * @param {function} config.parser_func A function that parses a single line of text and returns (usually) a
     *  structured object of data fields
     * @param {string} config.url_data The URL for the bgzipped and tabix-indexed file
     * @param {string} [config.url_tbi] The URL for the tabix index. Defaults to `url_data` + '.tbi'
     * @param {number} [config.params.overfetch = 0] Optionally fetch more data than is required to satisfy the
     *  region query. (specified as a fraction of the region size, 0-1).
     *  Useful for sources where interesting features might lie near the edges of the plot, eg BED track intervals.
     */
    class TabixUrlSource extends BaseAdapter {
        parseInit(init) {
            if (!init.parser_func || !init.url_data) {
                throw new Error('Tabix source is missing required configuration options');
            }
            this.parser = init.parser_func;
            // TODO: In the future, accept a pre-configured reader instance (as an alternative to the URL). Most useful
            //   for UIs that want to validate the tabix file before adding it to the plot, like LocalZoom.
            this.url_data = init.url_data;
            this.url_tbi = init.url_tbi || `${this.url_data}.tbi`;

            // In tabix mode, sometimes we want to fetch a slightly larger region than is displayed, in case a
            //    feature is on the edge of what the tabix query would return.
            //    Specify overfetch in units of % of total region size. ("fetch 10% extra before and after")
            const params = init.params || {};
            this.params = params;
            this._overfetch = params.overfetch || 0;

            if (this._overfetch < 0 || this._overfetch > 1) {
                throw new Error('Overfetch must be specified as a fraction (0-1) of the requested region size');
            }

            // Assuming that the `tabix-reader` library has been loaded via a CDN, this will create the reader
            // Since fetching the index is a remote operation, all reader usages will be via an async interface.
            this._reader_promise = tabix.urlReader(this.url_data, this.url_tbi).catch(function () {
                throw new Error('Failed to create a tabix reader from the provided URL');
            });
        }

        fetchRequest(state /*, chain, fields */) {
            return new Promise((resolve, reject) => {
                // Ensure that the reader is fully created (and index available), then make a query
                const region_start = state.start;
                const region_end = state.end;
                const extra_amount = this._overfetch * (region_end - region_start);

                const start = state.start - extra_amount;
                const end = state.end + extra_amount;
                this._reader_promise.then((reader) => {
                    reader.fetch(state.chr, start, end, function (data, err) {
                        if (err) {
                            reject(new Error('Could not read requested region. This may indicate an error with the .tbi index.'));
                        }
                        resolve(data);
                    });
                });
            });
        }

        normalizeResponse(data) {
            // Parse the data from lines of text to objects
            return data.map(this.parser);
        }
    }

    LocusZoom.Adapters.add('TabixUrlSource', TabixUrlSource);
}

if (typeof LocusZoom !== 'undefined') {
    // Auto-register the plugin when included as a script tag. ES6 module users must register via LocusZoom.use()
    // eslint-disable-next-line no-undef
    LocusZoom.use(install);
}


export default install;

