import { format, differenceInDays } from 'date-fns';

export default function PolicyCard({ policy }) {
  if (!policy) {
    return (
      <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl p-5 border border-dashed border-slate-300">
        <p className="text-slate-500 font-medium text-center py-4">No active policy this week</p>
        <p className="text-slate-400 text-xs text-center">Get covered before the next rain event</p>
      </div>
    );
  }

  const daysLeft = differenceInDays(new Date(policy.end_date), new Date());
  const urgency = daysLeft <= 1 ? 'red' : daysLeft <= 3 ? 'yellow' : 'green';
  const urgencyColor = { red: 'text-red-600', yellow: 'text-yellow-600', green: 'text-green-600' };

  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5 text-white shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-blue-200 text-xs font-medium uppercase tracking-wider">Active Policy</p>
          <p className="font-bold text-lg mt-0.5">{policy.policy_number}</p>
        </div>
        <div className="bg-green-400 text-green-900 text-xs font-bold px-3 py-1 rounded-full uppercase">
          Active
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-blue-200 text-xs">Weekly Coverage</p>
          <p className="font-bold text-xl mt-0.5">₹{parseFloat(policy.coverage_amount).toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-blue-200 text-xs">Weekly Premium</p>
          <p className="font-bold text-xl mt-0.5">₹{parseFloat(policy.weekly_premium).toFixed(0)}</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-blue-500 flex items-center justify-between text-xs">
        <span className="text-blue-200">
          Valid till {format(new Date(policy.end_date), 'dd MMM yyyy')}
        </span>
        <span className={`font-bold ${daysLeft <= 1 ? 'text-red-300' : 'text-green-300'}`}>
          {daysLeft <= 0 ? 'Expires today' : `${daysLeft}d remaining`}
        </span>
      </div>
    </div>
  );
}
