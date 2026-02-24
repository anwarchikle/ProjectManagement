function buildHorizontalOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: '#E5E7EB'
                }
            }
        },
        scales: {
            x: {
                beginAtZero: true,
                ticks: {
                    color: '#CBD5F5'
                },
                grid: {
                    color: 'rgba(148, 163, 184, 0.3)'
                }
            },
            y: {
                ticks: {
                    color: '#E5E7EB'
                },
                grid: {
                    display: false
                }
            }
        }
    };
}

export function initProjectStatusBarChart(ctx, labels, data) {
    return new window.Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Tasks by Status',
                    data,
                    backgroundColor: 'rgba(249, 115, 22, 0.9)', // orange
                    borderColor: 'rgba(234, 88, 12, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                }
            ]
        },
        options: buildHorizontalOptions()
    });
}

export function initResourceAllocationBarChart(ctx, labels, data) {
    return new window.Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Team Members',
                    data,
                    backgroundColor: 'rgba(37, 99, 235, 0.9)',
                    borderColor: 'rgba(37, 99, 235, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                }
            ]
        },
        options: buildHorizontalOptions()
    });
}