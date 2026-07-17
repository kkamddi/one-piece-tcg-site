export function auditEqualWeightedMarketIndex(built = {}, tolerance = 0.0002) {
  const aggregateTolerance = Math.max(tolerance, 0.01);
  const indexPoints = Array.isArray(built.indexPoints) ? built.indexPoints : [];
  const componentPoints = Array.isArray(built.componentPoints) ? built.componentPoints : [];
  if (!(built.dataComponents || []).length && !indexPoints.length && !componentPoints.length) {
    return {
      valid: true,
      noData: true,
      componentCount: 0,
      indexPointCount: 0,
      baseViolation: false,
      baselineViolations: [],
      componentFormulaViolations: [],
      indexFormulaViolations: [],
      admissionViolations: [],
      dailyMoveViolations: []
    };
  }
  const componentsByDate = new Map();
  const componentFormulaViolations = [];

  for (const point of componentPoints) {
    const date = String(point?.date || '');
    const price = Number(point?.price || 0);
    const basePrice = Number(point?.basePrice || 0);
    const rawValue = Number(point?.componentIndexValue || 0);
    if (!date || !(price > 0) || !(basePrice > 0) || !(rawValue > 0)) {
      componentFormulaViolations.push({ apparelId: point?.apparelId || 0, date, reason: 'invalid-component-point' });
      continue;
    }
    const expectedRaw = 100 * (price / basePrice);
    if (Math.abs(rawValue - expectedRaw) > tolerance) {
      componentFormulaViolations.push({
        apparelId: point?.apparelId || 0,
        date,
        expectedRaw: Number(expectedRaw.toFixed(4)),
        actualRaw: rawValue
      });
    }
    const values = componentsByDate.get(date) || [];
    values.push(rawValue);
    componentsByDate.set(date, values);
  }

  const firstIndexPoint = indexPoints[0] || null;
  const baseViolation = !firstIndexPoint
    || firstIndexPoint.date !== built.baseDate
    || Math.abs(Number(firstIndexPoint.value || 0) - Number(built.baseValue || 100)) > tolerance;
  const indexFormulaViolations = [];
  const dailyMoveViolations = [];
  for (let index = 0; index < indexPoints.length; index += 1) {
    const point = indexPoints[index];
    const values = componentsByDate.get(String(point?.date || '')) || [];
    const componentSum = values.reduce((sum, value) => sum + value, 0);
    const expected = values.length ? componentSum / values.length : 0;
    if (!values.length
      || Number(point?.activeCount || 0) !== values.length
      || Math.abs(Number(point?.rawComponentSum || 0) - componentSum) > aggregateTolerance
      || Math.abs(Number(point?.value || 0) - expected) > aggregateTolerance) {
      indexFormulaViolations.push({
        date: point?.date || '',
        expected: Number(expected.toFixed(4)),
        actual: Number(point?.value || 0),
        expectedRawComponentSum: Number(componentSum.toFixed(4)),
        actualRawComponentSum: Number(point?.rawComponentSum || 0),
        expectedActiveCount: values.length,
        actualActiveCount: Number(point?.activeCount || 0)
      });
    }
  }

  const admissionViolations = [];
  const baselineViolations = (built.dataComponents || []).filter((component) => {
    const firstPoint = component?.series?.[0];
    return !firstPoint
      || component.firstDate !== firstPoint.date
      || !(component.basePrice > 0)
      || Math.abs(firstPoint.price - component.basePrice) > tolerance;
  }).map((component) => ({ apparelId: Number(component?.apparelId || 0), firstDate: component?.firstDate || '' }));

  const valid = !baseViolation
    && baselineViolations.length === 0
    && componentFormulaViolations.length === 0
    && indexFormulaViolations.length === 0
    && admissionViolations.length === 0;
  return {
    valid,
    componentCount: (built.dataComponents || []).length,
    indexPointCount: indexPoints.length,
    baseViolation,
    baselineViolations,
    componentFormulaViolations,
    indexFormulaViolations,
    admissionViolations,
    dailyMoveViolations
  };
}

export function assertEqualWeightedMarketIndex(built = {}) {
  const audit = auditEqualWeightedMarketIndex(built);
  if (!audit.valid) {
    throw new Error(
      `Market index audit failed: base=${Number(audit.baseViolation)}, baselines=${audit.baselineViolations.length}, componentFormula=${audit.componentFormulaViolations.length}, indexFormula=${audit.indexFormulaViolations.length}, admissions=${audit.admissionViolations.length}, dailyMoves=${audit.dailyMoveViolations.length}`
    );
  }
  return audit;
}
