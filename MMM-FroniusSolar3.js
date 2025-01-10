Module.register("MMM-FroniusSolar3", {
    defaults: {
        updateInterval: 60000, // Update every 60 seconds
        width: "300px", // Dynamic width for grid layout
	icons: {
            P_Akku: "mdi:car-battery",
            P_Grid: "mdi:transmission-tower",
            P_Load: "mdi:home-lightbulb",
            P_PV: "mdi:solar-panel-large",
        	},
        Radius: 80, // Radius for the SVG gauges
        MaxPower: 1000, // Maximum power for grid, house, and battery
        MaxPowerPV: 10400, // Maximum power for solar PV
	ShowText: true,
        TextMessge: [
            { about: "600", Text: "Leicht erhöhter Netzbezug.", color: "#999" },
            { about: "1000", Text: "Über 1 KW Netzbezug!", color: "#ffffff" },
            { about: "1500", Text: "Über 1,5KW Netzbezug.", color: "#eea205" },
            { about: "2500", Text: "Über 2,5KW aus dem Netz!", color: "#ec7c25" },
            { about: "5000", Text: "Auto lädt, richtig? Nächstes Mal auf Sonne warten.", color: "#cc0605" },
            { less: "-500", Text: "Sonne scheint! Mehr als 500W frei.", color: "#f8f32b" },
            { less: "-2000", Text: "Wäsche waschen! Über 2KW freie Energie!", color: "#00bb2d" },
            { less: "-4000", Text: "Auto laden! Über 4KW freie Energie!", color: "#f80000" },
        ],
    },

    start: function () {
        this.solarData = null;
        this.sendSocketNotification("GET_FRONIUS_DATA");
        this.scheduleUpdate();
    },

    getStyles: function () {
        return ["MMM-FroniusSolar3.css", "https://code.iconify.design/2/2.2.1/iconify.min.js"];
    },

    scheduleUpdate: function () {
        const self = this;
        setInterval(function () {
            self.sendSocketNotification("GET_FRONIUS_DATA");
        }, this.config.updateInterval);
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "FRONIUS_DATA") {
            this.solarData = {
                P_Akku: Math.round(payload.P_Akku),
                P_Grid: Math.round(payload.P_Grid),
                P_Load: Math.round(payload.P_Load), // Placeholder, actual calculation follows
                P_PV: Math.round(payload.P_PV)
            };
	    this.solarSOC = payload.Inverters && payload.Inverters["1"] && payload.Inverters["1"].SOC
            ? Math.round(payload.Inverters["1"].SOC)
            : 0; // Fallback to 0 if SOC is undefined
            this.updateDom();
        }
    },

getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.className = "solar3-wrapper";
    wrapper.style.maxWidth = this.config.width;
    
    if (!this.solarData) {
        wrapper.innerHTML = "Loading...";
        return wrapper;
    }

    const radius = this.config.Radius;
    const maxPower = this.config.MaxPower;
    const maxPowerPV = this.config.MaxPowerPV;
 
    // Calculate P_Load as outerPower
    const outerPower = this.solarData.P_Grid + this.solarData.P_Akku + this.solarData.P_PV;

    const createGauge = (label, icon, value, percentage, color, subValue = null) => {
        const gaugeDiv = document.createElement("div");
        gaugeDiv.className = "gauge3-container";

        const strokeWidth = 12; // Match the stroke-width of the circles
        const adjustedRadius = radius - strokeWidth / 2; // Adjust radius to fit within the viewBox
        const svgSize = radius * 2 + strokeWidth; // Include stroke width in overall size
        const center = svgSize / 2; // Center coordinate

        gaugeDiv.innerHTML = `
            <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">
                <defs>
                    <filter id="glow-${label}">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>

                <!-- Circle Background -->
                <circle cx="${center}" cy="${center}" r="${adjustedRadius}" 
                    stroke="#e0e0e0" stroke-width="${strokeWidth}" fill="none" opacity="0.75"/>

                <!-- Circle Progress -->
                <circle cx="${center}" cy="${center}" r="${adjustedRadius}" 
                    stroke="${color}" stroke-width="${strokeWidth}" fill="none"
                    stroke-dasharray="${(percentage * 2 * Math.PI * adjustedRadius)} ${(2 * Math.PI * adjustedRadius)}" 
                    transform="rotate(-90 ${center} ${center})" filter="url(#glow-${label})"/>

                <!-- Text Inside Gauge -->
                <text x="${center}" y="${center - 5}" text-anchor="middle" alignment-baseline="middle" fill="#ffffff" font-size="18px">
                    ${value}
                </text>
                ${
                    subValue
                        ? `<text x="${center}" y="${center + 15}" text-anchor="middle" alignment-baseline="middle" fill="#ffffff" font-size="14px">
                            ${subValue}
                           </text>`
                        : ""
                }
            </svg>
            
            <div class="gauge3-label">
                <span class="iconify" data-icon="${icon}" data-inline="false"></span>
                <span style="margin-left: 5px;">${label}</span>
            </div>
        `;

        return gaugeDiv;
    };

    // Define colors for gauges
    const gridColor = this.solarData.P_Grid >= 0 ? "#808080" : "#add8e6"; // Gray for positive, light blue for negative
    const akkuColor = "#00ff00"; // Always green
    const pvColor = "#ffff00"; // Always yellow

    // House Gauge: Logic for color determination
    let houseColor;
    if ((this.solarData.P_Akku - 100) > Math.abs(this.solarData.P_Grid)) {
        houseColor = "#a3c49f"; // Light green for high battery activity
    } else if (this.solarData.P_Grid > 150) {
        houseColor = "#808080"; // Gray for high grid consumption
    } else if (outerPower > 0) {
        houseColor = "#00ff00"; // Green for positive power flow
    } else {
        houseColor = "#add8e6"; // Light blue
    }

    // Create gauges
    const gridGauge = createGauge(
        "Grid",
        this.config.icons.P_Grid,
        `${this.solarData.P_Grid} W`,
        Math.min(Math.abs(this.solarData.P_Grid) / maxPower, 1),
        gridColor
    );

const akkuGauge = createGauge(
    "Akku",
    this.config.icons.P_Akku,
    `${this.solarSOC}%`, // Main value: SOC percentage displayed
    this.solarSOC / 100, // Progress: SOC percentage
    akkuColor,
    `${this.solarData.P_Akku} W`, // Sub value: Power
);


    const pvGauge = createGauge(
        "PV",
        this.config.icons.P_PV,
        `${this.solarData.P_PV} W`,
        Math.min(this.solarData.P_PV / maxPowerPV, 1),
        pvColor
    );

    const houseGauge = createGauge(
        "House",
        this.config.icons.P_Load,
        `${outerPower} W`,
        Math.min(Math.abs(outerPower) / maxPower, 1),
        houseColor
    );

    // Append gauges to the wrapper
    wrapper.appendChild(gridGauge);
    wrapper.appendChild(akkuGauge);
    wrapper.appendChild(pvGauge);
    wrapper.appendChild(houseGauge);

	// Add dynamic text message below the gauge
    	if (this.config.ShowText) {
        const textMessageDiv = document.createElement("div");
        textMessageDiv.className = "text-message3";

        const messageConfig = this.config.TextMessge || [];
        let selectedMessage = null;

	for (const message of messageConfig) {
	    if (
	        (message.about && this.solarData.P_Grid > parseInt(message.about)) ||
	        (message.less && this.solarData.P_Grid < parseInt(message.less))
	    ) {
	        // If no message is selected yet, or the new match is more specific
	        if (
	            !selectedMessage ||
	            (message.about && parseInt(message.about) > parseInt(selectedMessage.about || -Infinity)) ||
	            (message.less && parseInt(message.less) < parseInt(selectedMessage.less || Infinity))
	        ) {
	            selectedMessage = message;
	        }
	    }
	}

        if (selectedMessage) {
            textMessageDiv.innerHTML = `
                <span style="color: ${selectedMessage.color}; font-size: 18px;">
                    ${selectedMessage.Text}
                </span>
            `;
        } else {
            textMessageDiv.innerHTML = `
                <span style="color: #999; font-size: 16px;">
                    PV Anlage läuft...
                </span>
            `;
        }

        wrapper.appendChild(textMessageDiv);
    	}
for (let i = 0; i < 3; i++) {
        const gaugeContainer = document.createElement("div");
        gaugeContainer.className = "gauge3-container";
        wrapper.appendChild(gaugeContainer);
    }
    
    return wrapper;
}


});
