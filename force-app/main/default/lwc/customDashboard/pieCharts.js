function pieOptions(position) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: position,
                labels: {
                    color: '#E5E7EB'
                }
            }
        }
    };
}

export function initRiskDistributionPieChart(ctx, labels, data) {
    return new window.Chart(ctx, {
        type: 'pie',
        data: {
            labels,
            datasets: [
                {
                    label: 'Tasks by Status',
                    data,
                    backgroundColor: [
                        '#60A5FA',
                        '#34D399',
                        '#FBBF24',
                        '#F97316',
                        '#A78BFA',
                        '#F472B6',
                        '#4B5563'
                    ],
                    borderWidth: 0
                }
            ]
        },
        options: pieOptions('right')
    });
}

export function initTaskCompletionPieChart(ctx, labels, data) {
    return new window.Chart(ctx, {
        type: 'pie',
        data: {
            labels,
            datasets: [
                {
                    label: 'Bugs by Status',
                    data,
                    backgroundColor: [
                        '#F97373',
                        '#FBBF24',
                        '#34D399',
                        '#60A5FA',
                        '#A78BFA',
                        '#F472B6',
                        '#4B5563'
                    ],
                    borderWidth: 0
                }
            ]
        },
        options: pieOptions('bottom')
    });
}