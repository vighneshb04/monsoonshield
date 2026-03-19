export default function WeatherBanner({ weather }) {
  if (!weather) return null;
  const rf = parseFloat(weather.rainfall_mm);
  const isFlood = rf >= 60 || weather.flood_alert;
  const isHeavy = rf >= 30 && rf < 60;

  if (!isFlood && !isHeavy) return null;

  return (
    <div className={`rounded-2xl p-4 mb-5 flex items-start gap-3 ${
      isFlood
        ? 'bg-red-50 border border-red-200'
        : 'bg-yellow-50 border border-yellow-200'
    }`}>
      <span className="text-2xl">{isFlood ? '🚨' : '⚠️'}</span>
      <div>
        <p className={`font-bold text-sm ${isFlood ? 'text-red-700' : 'text-yellow-700'}`}>
          {isFlood ? 'FLOOD ALERT — Parametric trigger active!' : 'Heavy Rain Warning'}
        </p>
        <p className={`text-xs mt-0.5 ${isFlood ? 'text-red-600' : 'text-yellow-600'}`}>
          {rf.toFixed(1)}mm rainfall recorded in last 3 hours.{' '}
          {isFlood
            ? 'Automatic claims are being generated for active policies.'
            : 'Stay safe. Rainfall approaching trigger threshold (60mm).'}
        </p>
      </div>
    </div>
  );
}
