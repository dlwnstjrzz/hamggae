export const SOCIAL_INSURANCE_RATES = {
    2019: {
        pension: 0.045, // 국민연금
        health: 0.0323, // 건강보험
        care: 0.00274873, // 장기요양 
        unemployment: 0.0065, // 고용(실업)
        stabilization: 0.0025, // 고용(안정)
        accident: 0.0075, // 산재
        total: 0.09654873 // 합계
    },
    2020: {
        pension: 0.045,
        health: 0.03335,
        care: 0.0034185,
        unemployment: 0.008,
        stabilization: 0.0025,
        accident: 0.0073,
        total: 0.0995685
    },
    2021: {
        pension: 0.045,
        health: 0.0343,
        care: 0.0039515,
        unemployment: 0.008,
        stabilization: 0.0025,
        accident: 0.007,
        total: 0.1007515
    },
    2022: {
        pension: 0.045,
        health: 0.03495,
        care: 0.0042885,
        unemployment: 0.0085,
        stabilization: 0.0025,
        accident: 0.007,
        total: 0.1022385
    },
    2023: {
        pension: 0.045,
        health: 0.03545,
        care: 0.004541,
        unemployment: 0.009,
        stabilization: 0.0025,
        accident: 0.007,
        total: 0.103491
    },
    2024: {
        pension: 0.045,
        health: 0.03545,
        care: 0.004591,
        unemployment: 0.009,
        stabilization: 0.0025,
        accident: 0.0066,
        total: 0.103141
    }
};

export const getSocialInsuranceRate = (year) => {
    return SOCIAL_INSURANCE_RATES[year] || SOCIAL_INSURANCE_RATES[2024]; // Default to latest if unknown
};
