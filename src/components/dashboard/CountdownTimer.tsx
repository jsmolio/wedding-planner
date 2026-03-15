import { useEffect, useState } from 'react';
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Heart } from 'lucide-react';

interface CountdownTimerProps {
  weddingDate: string;
  partner1: string;
  partner2: string;
}

export function CountdownTimer({ weddingDate, partner1, partner2 }: CountdownTimerProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const target = new Date(weddingDate);
  const days = differenceInDays(target, now);
  const hours = differenceInHours(target, now) % 24;
  const minutes = differenceInMinutes(target, now) % 60;
  const seconds = differenceInSeconds(target, now) % 60;

  const isPast = days < 0;

  return (
    <Card className="bg-gradient-to-r from-primary-500 to-primary-600 text-white border-0">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Heart className="w-5 h-5 fill-white" />
          <h2 className="text-lg font-semibold">{partner1} & {partner2}</h2>
          <Heart className="w-5 h-5 fill-white" />
        </div>
        {isPast ? (
          <p className="text-2xl font-bold">Congratulations! You're married!</p>
        ) : (
          <>
            <div className="flex justify-center gap-6 my-4">
              {[
                { value: days, label: 'Days' },
                { value: hours, label: 'Hours' },
                { value: minutes, label: 'Min' },
                { value: seconds, label: 'Sec' },
              ].map(({ value, label }) => (
                <div key={label} className="text-center">
                  <div className="text-4xl font-bold tabular-nums">
                    {Math.max(0, value)}
                  </div>
                  <div className="text-sm text-primary-100">{label}</div>
                </div>
              ))}
            </div>
            <p className="text-primary-100 text-sm">until your special day</p>
          </>
        )}
      </div>
    </Card>
  );
}
