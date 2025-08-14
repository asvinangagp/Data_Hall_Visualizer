// calculator.js
Chart.register(window['chartjs-plugin-annotation']);

// INPUTS
//
const hallSizeSelect = document.getElementById('hall-size');
const rackSpacingInput = document.getElementById('rack-spacing');
const racksPerRowInput = document.getElementById('racks-per-row');
//
const coolingSlider = document.getElementById('cooling-slider');
const coolingLabelDynamic = document.getElementById('cooling-label-dynamic');
const lcOverrideCheckbox = document.getElementById('lc-override');
const ahuCost = parseFloat(document.getElementById('ahu-cost').value);
const cduCost = parseFloat(document.getElementById('cdu-cost').value);
//
const ahuCapacitySelect = document.getElementById('ahu-capacity');
const cduCentralSelect = document.getElementById('cdu-central-capacity');
const cduInRowSelect = document.getElementById('cdu-inrow-capacity');
const acrCpuSlider = document.getElementById('acr-cpu');
const acrGpuSlider = document.getElementById('acr-gpu');
const cpuGpuSlider = document.getElementById('cpu-gpu-slider');
const cpuGpuLabel = document.getElementById('cpu-gpu-label');
const rackDensityCpuSelect = document.getElementById('rack-density-cpu');
const rackDensityGpuSelect = document.getElementById('rack-density-gpu');
// OUTPUTS

function recalculate() {
  // 1. Raw Input Values
  const Size_dh = parseFloat(hallSizeSelect.value);         // MW IT
  const Ratio_lc = parseInt(coolingSlider.value); 			// % liquid
  const Ratio_ac = 100 - Ratio_lc;                			// % air
  coolingLabelDynamic.textContent = `${Ratio_ac}% / ${Ratio_lc}%`;
  const rackSpacing = parseFloat(rackSpacingInput.value);   // meters
  const racksPerRow = parseInt(racksPerRowInput.value);     // count
  const Cap_ahu = parseFloat(ahuCapacitySelect.value);      // kW
  const Cap_cdu_central = parseFloat(cduCentralSelect.value); // MW
  const Cap_cdu_inrow = parseFloat(cduInRowSelect.value);     // MW
  const ACR_gpu = parseInt(acrGpuSlider.value) / 100;       // %
  const ACR_cpu = parseInt(acrCpuSlider.value) / 100;       // %

  // 2. IT Load Split
  const Size_ac_raw = Size_dh * (Ratio_ac / 100);           // MW IT
  const Size_lc_raw = Size_dh - Size_ac_raw;                // MW IT

	const gpuPercent = parseInt(cpuGpuSlider.value) / 100;
	const cpuPercent = 1 - gpuPercent;

	const Size_lc_cpu = Size_lc_raw * cpuPercent;
	const Size_lc_gpu = Size_lc_raw * gpuPercent;

	// Apply ACR profiles
	const Size_lc_cpu_liquid = Size_lc_cpu * ACR_cpu;
	const Size_lc_cpu_air = Size_lc_cpu * (1 - ACR_cpu);

	const Size_lc_gpu_liquid = Size_lc_gpu * ACR_gpu;
	const Size_lc_gpu_air = Size_lc_gpu * (1 - ACR_gpu);

	const Size_lc_liquid = Size_lc_cpu_liquid + Size_lc_gpu_liquid;
	const Size_lc_air = Size_lc_cpu_air + Size_lc_gpu_air;

  const Size_ac_total = Size_ac_raw + Size_lc_air;          // MW IT
  const Size_lc_total = Size_lc_liquid;                     // MW IT

  // 3. Racks
	const Density_cpu = parseFloat(rackDensityCpuSelect.value); // kW
	const Density_gpu = parseFloat(rackDensityGpuSelect.value); // kW

// Breakdown CPU/GPU loads
	const Size_ac_cpu = Size_ac_raw * cpuPercent;
	const Size_ac_gpu = Size_ac_raw * gpuPercent;

	const Count_rack_cpu = Math.floor((Size_ac_cpu * 1000) / Density_cpu);
	const Count_rack_gpu = Math.floor((Size_ac_gpu * 1000) / Density_gpu);

	const Count_rack_ac = Count_rack_cpu + Count_rack_gpu;

	const Count_rack_lc = Math.floor((Size_lc_total * 1000) / ((Density_cpu + Density_gpu) / 2)); // avg assumption
	const Count_rack_total = Count_rack_ac + Count_rack_lc;


  // 4. Cooling Units
  const Count_ahu = Math.ceil((Size_ac_total * 1000) / Cap_ahu);
  const Count_cdu_central = Math.ceil((Size_lc_total * 1000) / Cap_cdu_central); // all in kW
  const Count_cdu_inrow = Math.ceil((Size_lc_total * 1000) / Cap_cdu_inrow);

  // 5. Output to DOM (same order as result cards)
// Output updated values to UI
document.getElementById("result-ac-load").textContent = Size_ac_total.toFixed(2);
document.getElementById("result-lc-load").textContent = Size_lc_total.toFixed(2);
document.getElementById("result-total-load").textContent = Size_dh.toFixed(2);

document.getElementById("result-rack-cpu").textContent = Count_rack_cpu;
document.getElementById("result-rack-gpu").textContent = Count_rack_gpu;
document.getElementById("result-rack-lc").textContent = Count_rack_lc;
document.getElementById("result-rack-total").textContent = Count_rack_total;

document.getElementById("result-ahu").textContent = Count_ahu;
document.getElementById("result-cdu-central").textContent = Count_cdu_central;
document.getElementById("result-cdu-inrow").textContent = Count_cdu_inrow;

document.getElementById("result-cpugpu").textContent = `${Math.round(cpuPercent * 100)}% / ${Math.round(gpuPercent * 100)}%`;
document.getElementById("result-acr").textContent = `${Math.round(ACR_cpu * 100)}% / ${Math.round(ACR_gpu * 100)}%`;
document.getElementById("result-density").textContent = `${Density_cpu} / ${Density_gpu} kW`;
updateRackVisualization();

}

// Bind all relevant events
[
  hallSizeSelect,
  rackSpacingInput,
  racksPerRowInput,
  rackDensityCpuSelect,
  rackDensityGpuSelect,
  ahuCapacitySelect,
  cduCentralSelect,
  cduInRowSelect,
  acrGpuSlider,
  acrCpuSlider,
  document.getElementById('ahu-cost'),    
  document.getElementById('cdu-cost'),     
].forEach(input => input.addEventListener('input', () => {
  recalculate();
  updateAhuCduChart();
  updateRackVisualization();  
  updateCostChart();
}));

// Initial run
recalculate();

let ahuCduChart;
let costChart;  // for Optimised Cost chart




// Fixed cooling slider event listener
coolingSlider.addEventListener('input', () => {
  let snappedValue = Math.round(coolingSlider.value / 10) * 10;
  const allowOverride = lcOverrideCheckbox.checked;

  // Apply cap logic
  if (!allowOverride && snappedValue > 80) {
    snappedValue = 80;
    coolingSlider.value = 80; // Force slider back to 80
  }

  // Update the label
  const Ratio_lc = snappedValue;
  const Ratio_ac = 100 - Ratio_lc;
  coolingLabelDynamic.textContent = `${Ratio_ac}% / ${Ratio_lc}%`;

  // Update chart annotation line
  if (ahuCduChart && ahuCduChart.options.plugins?.annotation?.annotations?.lcLine) {
    ahuCduChart.options.plugins.annotation.annotations.lcLine.xMin = Ratio_lc;
    ahuCduChart.options.plugins.annotation.annotations.lcLine.xMax = Ratio_lc;
    ahuCduChart.update();
  }

  recalculate();
  updateAhuCduChart();
  updateCostChart();
});

// Fixed toggle event listener
lcOverrideCheckbox.addEventListener('change', () => {
  const allowOverride = lcOverrideCheckbox.checked;
  const sliderMask = document.querySelector('.slider-mask');
  
  if (sliderMask) {
    sliderMask.style.display = allowOverride ? 'none' : 'block';
  }

  // If turning override OFF and current value > 80, snap back to 80
  if (!allowOverride && parseInt(coolingSlider.value) > 80) {
    coolingSlider.value = 80;
    coolingSlider.dispatchEvent(new Event('input'));
  }
});

// CPU/GPU slider event listener
cpuGpuSlider.addEventListener('input', () => {
  const gpuPercent = parseInt(cpuGpuSlider.value);
  const cpuPercent = 100 - gpuPercent;
  cpuGpuLabel.textContent = `${cpuPercent}% / ${gpuPercent}%`;
  recalculate();
  updateAhuCduChart();
  updateCostChart();
});


// Initialize chart after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initAhuCduChart();
  recalculate();
  updateRackVisualization();
  updateCostChart();
});




function initAhuCduChart() {
  const ctx = document.getElementById('ahuCduChart').getContext('2d');

  const liquidRatios = Array.from({ length: 101 }, (_, i) => i); // 0% to 100%
  const ahuCounts = [];
  const cduCounts = [];

  // Get current values
  const Size_dh = parseFloat(hallSizeSelect.value);
  const Cap_ahu = parseFloat(ahuCapacitySelect.value);
  const Cap_cdu_central = parseFloat(cduCentralSelect.value);
  const gpuPercent = parseInt(cpuGpuSlider.value) / 100;
  const cpuPercent = 1 - gpuPercent;
  const ACR_cpu = parseInt(acrCpuSlider.value) / 100;
  const ACR_gpu = parseInt(acrGpuSlider.value) / 100;

 for (let i = 0; i <= 100; i++) {
  const { Count_ahu, Count_cdu } = computeCoolingUnits(
    i, Size_dh, Cap_ahu, Cap_cdu_central, cpuPercent, gpuPercent, ACR_cpu, ACR_gpu
  );
  ahuCounts.push(Count_ahu);
  cduCounts.push(Count_cdu);
}

  ahuCduChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: liquidRatios,
      datasets: [
        {
          label: 'AHU Count',
          data: ahuCounts,
          borderColor: '#2196f3',
          borderWidth: 2,
          fill: false,
          stepped: true,
          pointRadius: 0,
          pointHoverRadius: 0
        },
        {
          label: 'CDU Count',
          data: cduCounts,
          borderColor: '#f44336',
          borderWidth: 2,
          fill: false,
          stepped: true,
          pointRadius: 0,
          pointHoverRadius: 0
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        annotation: {
          annotations: {
            lcLine: {
              type: 'line',
              xMin: parseInt(coolingSlider.value),
              xMax: parseInt(coolingSlider.value),
              borderColor: 'rgba(0,0,0,0.5)',
              borderWidth: 2,
              label: {
				content: (ctx) => {
					const x = ctx.chart.options.plugins.annotation.annotations.lcLine.xMin;
					// Get fresh values each time the label is rendered
					const fresh_gpuPercent = parseInt(cpuGpuSlider.value) / 100;
					const fresh_cpuPercent = 1 - fresh_gpuPercent;
					const fresh_ACR_cpu = parseInt(acrCpuSlider.value) / 100;
					const fresh_ACR_gpu = parseInt(acrGpuSlider.value) / 100;
					const fresh_Size_dh = parseFloat(hallSizeSelect.value);
					const fresh_Cap_ahu = parseFloat(ahuCapacitySelect.value);
					const fresh_Cap_cdu_central = parseFloat(cduCentralSelect.value);
					
					const { Count_ahu, Count_cdu } = computeCoolingUnits(
					  x, fresh_Size_dh, fresh_Cap_ahu, fresh_Cap_cdu_central, 
					  fresh_cpuPercent, fresh_gpuPercent, fresh_ACR_cpu, fresh_ACR_gpu
					);
					return [
					  'Current LC%',
					  `AHU: ${Count_ahu} units`,
					  `CDU: ${Count_cdu} units`
					];
				},
                enabled: true,
                position: 'top',
                color: '#000',
                backgroundColor: 'rgba(255,255,255,0.8)',
                font: {
                  size: 12,
                  weight: 'normal'
                },
                padding: 6
              }
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Liquid Cooling Ratio (%)' },
          min: 0,
          max: 100,
          ticks: {
            stepSize: 10
          },
          grid: {
            drawOnChartArea: true,
            drawTicks: true
          }
        },
        y: {
          title: { display: true, text: 'Unit Count' },
          beginAtZero: true
        }
      }
    }
  });
}

function updateAhuCduChart() {
  if (!ahuCduChart) return;
  
  const liquidRatios = Array.from({ length: 101 }, (_, i) => i); // 0–100%

  // Get current values
  const Size_dh = parseFloat(hallSizeSelect.value);
  const Cap_ahu = parseFloat(ahuCapacitySelect.value);
  const Cap_cdu_central = parseFloat(cduCentralSelect.value);
  const gpuPercent = parseInt(cpuGpuSlider.value) / 100;
  const cpuPercent = 1 - gpuPercent;
  const ACR_cpu = parseInt(acrCpuSlider.value) / 100;
  const ACR_gpu = parseInt(acrGpuSlider.value) / 100;

  const ahuCounts = [];
  const cduCounts = [];

 for (let i = 0; i <= 100; i++) {
  const { Count_ahu, Count_cdu } = computeCoolingUnits(
    i, Size_dh, Cap_ahu, Cap_cdu_central, cpuPercent, gpuPercent, ACR_cpu, ACR_gpu
  );
  ahuCounts.push(Count_ahu);
  cduCounts.push(Count_cdu);
}

  const currentLC = parseInt(coolingSlider.value);

  ahuCduChart.data.datasets[0].data = ahuCounts;
  ahuCduChart.data.datasets[1].data = cduCounts;

  // Update line annotation
  if (ahuCduChart.options.plugins?.annotation?.annotations?.lcLine) {
    ahuCduChart.options.plugins.annotation.annotations.lcLine.xMin = currentLC;
    ahuCduChart.options.plugins.annotation.annotations.lcLine.xMax = currentLC;
  }

  ahuCduChart.update();
}




function computeCoolingUnits(ratioLc, Size_dh, Cap_ahu, Cap_cdu_central, cpuPercent, gpuPercent, ACR_cpu, ACR_gpu) {
  const Ratio_ac = 100 - ratioLc;

  const Size_ac_raw = Size_dh * (Ratio_ac / 100);
  const Size_lc_raw = Size_dh - Size_ac_raw;

  const Size_lc_cpu = Size_lc_raw * cpuPercent;
  const Size_lc_gpu = Size_lc_raw * gpuPercent;

  const Size_lc_cpu_liquid = Size_lc_cpu * ACR_cpu;
  const Size_lc_cpu_air = Size_lc_cpu * (1 - ACR_cpu);
  const Size_lc_gpu_liquid = Size_lc_gpu * ACR_gpu;
  const Size_lc_gpu_air = Size_lc_gpu * (1 - ACR_gpu);

  const Size_ac_total = Size_ac_raw + Size_lc_cpu_air + Size_lc_gpu_air;
  const Size_lc_total = Size_lc_cpu_liquid + Size_lc_gpu_liquid;

  const Count_ahu = Math.ceil((Size_ac_total * 1000) / Cap_ahu);
  const Count_cdu = Math.ceil((Size_lc_total * 1000) / Cap_cdu_central); // match main logic

  return { Count_ahu, Count_cdu };
}


function updateRackVisualization() {
  const canvas = document.getElementById('rackCanvas');
  const ctx = canvas.getContext('2d');

  // Clear canvas and resize
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // === INPUTS ===
  const hallSize = parseFloat(hallSizeSelect.value); // MW
  const densityCPU = parseFloat(rackDensityCpuSelect.value); // kW
  const densityGPU = parseFloat(rackDensityGpuSelect.value); // kW
  const racksPerRow = parseInt(racksPerRowInput.value);
  const maxAHUCapacity = parseFloat(ahuCapacitySelect.value); // kW

  const countRackCPU = parseInt(document.getElementById("result-rack-cpu").textContent);
  const countRackGPU = parseInt(document.getElementById("result-rack-gpu").textContent);
  const countRackAC = countRackCPU + countRackGPU;
  const countRackLC = parseInt(document.getElementById("result-rack-lc").textContent);

  const countAHU = parseInt(document.getElementById("result-ahu").textContent);
  const countCDU = parseInt(document.getElementById("result-cdu-central").textContent);

  // === AHU/CDU SLOT LOGIC ===
  const totalAhuSlots = Math.ceil((hallSize * 1000) / maxAHUCapacity); // Max equivalent slots
  const cduSlots = Math.ceil(countCDU / 2); // 2 CDUs = 1 slot
  const ahuSlots = countAHU;
  const blankSlots = Math.max(totalAhuSlots - (ahuSlots + cduSlots), 0);

  // Fill the slot array
  const slots = [];
  let remAHU = ahuSlots/2;
  let remCDU = countCDU/2;

  for (let i = 0; i < Math.ceil(totalAhuSlots/2); i++) {
    if (remAHU > 0) {
      slots.push({ type: 'AHU' });
      remAHU--;
    } else if (remCDU >= 2) {
      slots.push({ type: 'CDU' });
      remCDU -= 2;
    } else {
      slots.push({ type: 'BLANK' });
    }
  }

  // === RACKS ===
  const totalLoad = hallSize * 1000; // kW
  const totalRacks = Math.floor(totalLoad / densityCPU);
  const rowCount = Math.ceil(totalRacks / racksPerRow);

  const gapX = 120 / rowCount;
  const gapY = 0;
  const padding = 25;

  const availableWidth = canvas.width - padding * 2 - (rowCount - 1) * gapX;
  const availableHeight = canvas.height - padding * 2 - (racksPerRow - 1) * gapY;

  const rackWidth = availableWidth / rowCount;
  const rackHeight = availableHeight / racksPerRow;

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < racksPerRow; c++) {
      const i = r * racksPerRow + c;
      if (i >= totalRacks) break;

      const x = padding + r * (rackWidth + gapX);
      const y = padding + c * (rackHeight + gapY);

      let color = '#ccc'; // Default: unused
      if (i < countRackAC) color = '#2196f3'; // Blue
      else if (i < countRackAC + countRackLC) color = '#e53935'; // Red

      ctx.fillStyle = color;
      ctx.fillRect(x, y, rackWidth, rackHeight);
      ctx.strokeStyle = '#999';
      ctx.strokeRect(x, y, rackWidth, rackHeight);
    }
  }

  // === DRAW AHU/CDU SLOTS (Top and Bottom) ===
  const slotHeight = 20;
  const slotWidth = canvas.width / totalAhuSlots;

  slots.forEach((slot, index) => {
    const x = index * slotWidth *2
    const topY = 0;
    const bottomY = canvas.height - slotHeight;

    let fill = '#fff';
    let label = '';

    if (slot.type === 'AHU') {
      fill = '#ff9800'; label = 'A';
    } else if (slot.type === 'CDU') {
      fill = '#4caf50'; label = 'C';
    }

    // Top
    ctx.fillStyle = fill;
    ctx.fillRect(x, topY, slotWidth, slotHeight);
    ctx.strokeStyle = '#666';
    ctx.strokeRect(x, topY, slotWidth, slotHeight);
    ctx.fillStyle = '#000';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + slotWidth / 2, topY + 14);

    // Bottom
    ctx.fillStyle = fill;
    ctx.fillRect(x, bottomY, slotWidth, slotHeight);
    ctx.strokeStyle = '#666';
    ctx.strokeRect(x, bottomY, slotWidth, slotHeight);
    ctx.fillStyle = '#000';
    ctx.fillText(label, x + slotWidth / 2, bottomY + 14);
  });
}

function updateCostChart() {
  if (!document.getElementById('costChart')) return;

  const ctx = document.getElementById('costChart').getContext('2d');
  const ahuCostVal = parseFloat(document.getElementById('ahu-cost').value);
  const cduCostVal = parseFloat(document.getElementById('cdu-cost').value);

  const Size_dh = parseFloat(hallSizeSelect.value);
  const gpuPercent = parseInt(cpuGpuSlider.value) / 100;
  const cpuPercent = 1 - gpuPercent;
  const ACR_cpu = parseInt(acrCpuSlider.value) / 100;
  const ACR_gpu = parseInt(acrGpuSlider.value) / 100;

  const labels = [];
  const costs = [];

  for (let lc = 0; lc <= 100; lc += 5) {
    const Ratio_ac = 100 - lc;

    const Size_ac_raw = Size_dh * (Ratio_ac / 100);
    const Size_lc_raw = Size_dh - Size_ac_raw;

    const Size_lc_cpu = Size_lc_raw * cpuPercent;
    const Size_lc_gpu = Size_lc_raw * gpuPercent;

    const Size_lc_cpu_liquid = Size_lc_cpu * ACR_cpu;
    const Size_lc_cpu_air = Size_lc_cpu * (1 - ACR_cpu);
    const Size_lc_gpu_liquid = Size_lc_gpu * ACR_gpu;
    const Size_lc_gpu_air = Size_lc_gpu * (1 - ACR_gpu);

    const Size_ac_total = Size_ac_raw + Size_lc_cpu_air + Size_lc_gpu_air;
    const Size_lc_total = Size_lc_cpu_liquid + Size_lc_gpu_liquid;

    const cost = ahuCostVal * Size_ac_total * 1000 + cduCostVal * Size_lc_total * 1000;

    labels.push(lc);
    costs.push(cost);
  }

// Find min cost point with interpolation for better accuracy
const minCost = Math.min(...costs);
const maxCost = Math.max(...costs);
const minIndex = costs.indexOf(minCost);
let minLCR = labels[minIndex];

// Optional: Interpolate for more precise minimum (parabolic fit)
if (minIndex > 0 && minIndex < costs.length - 1) {
  const y1 = costs[minIndex - 1];
  const y2 = costs[minIndex];
  const y3 = costs[minIndex + 1];
  const x1 = labels[minIndex - 1];
  const x2 = labels[minIndex];
  const x3 = labels[minIndex + 1];
  
  // Parabolic interpolation to find exact minimum
  const denom = (x1 - x2) * (x1 - x3) * (x2 - x3);
  if (denom !== 0) {
    const a = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / denom;
    const b = (x3 * x3 * (y1 - y2) + x2 * x2 * (y3 - y1) + x1 * x1 * (y2 - y3)) / denom;
    
    if (a > 0) { // Ensure it's a minimum (parabola opens upward)
      const exactMinLCR = -b / (2 * a);
      if (exactMinLCR >= x1 && exactMinLCR <= x3) {
        minLCR = exactMinLCR;
      }
    }
  }
}

const costPerKW = minCost / (Size_dh * 1000);

const annotationLabel = [
  `Optimal LCR: ${minLCR.toFixed(1)}%`,
  `Min Cost: $${minCost.toLocaleString(undefined, {maximumFractionDigits: 0})}`,
  `Max Cost: $${maxCost.toLocaleString(undefined, {maximumFractionDigits: 0})}`,
];

  // If chart already exists, update it
  if (costChart) {
    costChart.data.labels = labels;
    costChart.data.datasets[0].data = costs;
    costChart.options.plugins.annotation.annotations.optLine.xMin = minLCR;
    costChart.options.plugins.annotation.annotations.optLine.xMax = minLCR;
    costChart.options.plugins.annotation.annotations.optLine.label.content = annotationLabel;
    costChart.update();
    return;
  }

  // Initialize chart
  costChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
		datasets: [{
		  label: 'Cooling Cost ($)',
		  data: costs,
		  borderColor: '#009688',
		  borderWidth: 3,
		  fill: false,
		  tension: 0.4,  // ← Increased for more curved appearance
		  pointRadius: 3,
		  pointHoverRadius: 6,
		  pointBackgroundColor: '#009688',
		  pointBorderColor: '#ffffff',
		  pointBorderWidth: 2
		}]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        annotation: {
          annotations: {
            optLine: {
              type: 'line',
              xMin: minLCR,
              xMax: minLCR,
              borderColor: 'rgba(0,0,0,0.5)',
              borderWidth: 2,
				label: {
				  content: annotationLabel,
				  enabled: true,
				  position: 'top',
				  backgroundColor: 'rgba(255,255,255,0.95)',
				  color: '#000',
				  font: {
					size: 11,
					weight: 'bold'
				  },
				  padding: 8,
				  cornerRadius: 4,
				  borderColor: '#009688',
				  borderWidth: 1
				}
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Liquid Cooling Ratio (%)' },
          min: 0,
          max: 100,
          ticks: { stepSize: 10 }
        },
        y: {
          title: { display: true, text: 'Total Cooling Cost ($)' },
          beginAtZero: true
        }
      }
    }
  });
}