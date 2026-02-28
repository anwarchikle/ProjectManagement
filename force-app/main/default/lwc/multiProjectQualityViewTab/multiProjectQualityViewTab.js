import { LightningElement, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import CHARTJS from '@salesforce/resourceUrl/chartJs';
import getMultiProjectQualityData from '@salesforce/apex/QaViewDashboardController.getMultiProjectQualityData';

export default class MultiProjectQualityViewTab extends LightningElement {
    @track isLoading      = true;
    @track hasError       = false;
    @track errorMessage   = '';
    @track isDataLoaded   = false;
    @track backlogRows    = [];
    @track escapedRecords = [];
    @track escapedTotalCount = 0;
    @track overallScore   = 0;

    _chartData     = [];
    _chartRendered = false;
    _chart         = null;

    connectedCallback() {
        Promise.all([
            loadScript(this, CHARTJS),
            getMultiProjectQualityData()
        ])
        .then(([, result]) => {
            this._chartData     = result.chartData      || [];
            this.backlogRows    = result.backlogRows     || [];
            this.overallScore   = result.overallScore   || 0;

            const allEscaped       = result.escapedRecords || [];
            this.escapedTotalCount = allEscaped.length;
            this.escapedRecords    = this.processEscaped(allEscaped.slice(0, 10));

            console.log('chartData:', JSON.stringify(this._chartData));
            console.log('backlogRows:', JSON.stringify(this.backlogRows));

            this.isDataLoaded = true;
        })
        .catch((error) => {
            this.hasError     = true;
            this.errorMessage = error?.body?.message || error?.message || 'An error occurred.';
            console.error('Error:', error);
        })
        .finally(() => {
            this.isLoading = false;
        });
    }

    renderedCallback() {
        if (!this.isDataLoaded || this._chartRendered) return;
        const canvas = this.template.querySelector('.chart-canvas');
        if (!canvas) return;
        this._chartRendered = true;
        this.initChart(canvas);
    }

    initChart(canvas) {
        // Build datasets dynamically from actual severity picklist values returned
        // _chartData shape: [{ project, severities: { 'Critical': 2, 'High': 1, ... } }, ...]
        const labels = this._chartData.map(d => d.project);

        // Collect all unique severity values across all projects
        const severitySet = new Set();
        this._chartData.forEach(d => {
            Object.keys(d.severities || {}).forEach(s => severitySet.add(s));
        });
        const severities = Array.from(severitySet).sort();

        // Color palette for severities
        const colorPalette = [
            '#ba0517', '#e07b1f', '#0176d3', '#9e9e9e',
            '#d0d0d0', '#2e7d32', '#7b1fa2', '#0288d1'
        ];

        const datasets = severities.map((sev, idx) => ({
            label          : sev,
            data           : this._chartData.map(d => Number((d.severities || {})[sev]) || 0),
            backgroundColor: colorPalette[idx % colorPalette.length],
            stack          : 'stack'
        }));

        // eslint-disable-next-line no-undef
        this._chart = new Chart(canvas, {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive         : true,
                maintainAspectRatio: false,
                legend: {
                    display : true,
                    position: 'bottom',
                    labels  : { boxWidth: 12, fontSize: 11 }
                },
                tooltips: { mode: 'index', intersect: false },
                scales: {
                    xAxes: [{
                        stacked  : true,
                        gridLines: { display: false },
                        ticks    : { fontSize: 11 }
                    }],
                    yAxes: [{
                        stacked  : true,
                        ticks    : {
                            beginAtZero: true,
                            min        : 0,
                            stepSize   : 1,
                            fontSize   : 11,
                            // Never show negative values
                            callback: function(value) {
                                if (value < 0) return '';
                                return Number.isInteger(value) ? value : '';
                            }
                        },
                        gridLines: { color: '#f0f0f0' }
                    }]
                }
            }
        });
    }

    processEscaped(records) {
        return records.map(rec => ({
            ...rec,
            severityClass: this.getSeverityClass(rec.severity),
            statusClass  : this.getStatusClass(rec.status),
            hasSeverity  : rec.severity != null && rec.severity !== '',
            hasStatus    : rec.status   != null && rec.status   !== ''
        }));
    }

    getSeverityClass(severity) {
        // Covers both S1-S5 and named picklist values like Critical, Show Stopper etc.
        const map = {
            'S1'          : 'sev-badge sev-badge--s1',
            'S2'          : 'sev-badge sev-badge--s2',
            'S3'          : 'sev-badge sev-badge--s3',
            'S4'          : 'sev-badge sev-badge--s4',
            'S5'          : 'sev-badge sev-badge--s5',
            'Critical'    : 'sev-badge sev-badge--s1',
            'Show Stopper': 'sev-badge sev-badge--s1',
            'High'        : 'sev-badge sev-badge--s2',
            'Medium'      : 'sev-badge sev-badge--s3',
            'Low'         : 'sev-badge sev-badge--s4'
        };
        // Fall back to a generic badge that auto-sizes to content
        return map[severity] || 'sev-badge sev-badge--default';
    }

    getStatusClass(status) {
        const map = {
            'Reopened'    : 'status-badge status-badge--reopened',
            'Open'        : 'status-badge status-badge--open',
            'In Progress' : 'status-badge status-badge--inprogress',
            'To be Tested': 'status-badge status-badge--qa',
            'In Retest'   : 'status-badge status-badge--qa',
            'Closed'      : 'status-badge status-badge--closed'
        };
        return map[status] || 'status-badge status-badge--open';
    }

    get hasBacklogRows() {
        return this.backlogRows && this.backlogRows.length > 0;
    }

    get hasEscapedRecords() {
        return this.escapedRecords && this.escapedRecords.length > 0;
    }
}