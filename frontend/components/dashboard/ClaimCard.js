import { format } from 'date-fns';

const STATUS_STYLES = {
  paid:       'bg-blue-100 text-blue-700',
  approved:   'bg-green-100 text-green-700',
  pending:    'bg-yellow-100 text-yellow-700',
  rejected:   'bg-red-100 text-red-700',
  fraud_hold: 'bg-orange-100 text-orange-700',
};

const TRIGGER_ICONS = {
  rainfall:    '🌧️',
  volume_drop: '📦',
  combined:    '⛈️',
};

export default function ClaimCard({ claim }) {
  const statusStyle = STATUS_STYLES[claim.status] || 'bg-slate-100 text-slate-600';
  const icon = TRIGGER_ICONS[claim.trigger_type] || '📄';
  const date = format(new Date(claim.created_at), 'dd MMM yyyy, hh:mm a');

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">
            {icon}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{claim.claim_number}</p>
            <p className="text-xs text-slate-500 capitalize mt-0.5">
              {claim.trigger_type?.replace('_', ' ')} trigger
              {claim.zone_name && ` · ${claim.zone_name}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-blue-700 text-base">₹{parseFloat(claim.claim_amount).toFixed(0)}</p>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle} capitalize`}>
            {claim.status === 'fraud_hold' ? 'Under Review' : claim.status}
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <span>{date}</span>
        {claim.fraud_score > 0 && (
          <span className={`font-medium ${claim.fraud_score > 5 ? 'text-orange-500' : 'text-slate-400'}`}>
            Fraud score: {parseFloat(claim.fraud_score).toFixed(1)}/10
          </span>
        )}
        {claim.payout_number && (
          <span className="text-green-600 font-medium">✓ Paid: {claim.payout_number}</span>
        )}
      </div>
    </div>
  );
}
