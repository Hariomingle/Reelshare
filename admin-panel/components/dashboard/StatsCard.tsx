import React from 'react';
import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface StatsCardProps {
  title: string;
  value: string;
  change: number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'primary' | 'purple' | 'red' | 'yellow';
  loading?: boolean;
}

const colorClasses = {
  blue: {
    icon: 'text-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-900',
    change: 'text-blue-600 dark:text-blue-400'
  },
  green: {
    icon: 'text-green-500',
    bg: 'bg-green-100 dark:bg-green-900',
    change: 'text-green-600 dark:text-green-400'
  },
  primary: {
    icon: 'text-primary-500',
    bg: 'bg-primary-100 dark:bg-primary-900',
    change: 'text-primary-600 dark:text-primary-400'
  },
  purple: {
    icon: 'text-purple-500',
    bg: 'bg-purple-100 dark:bg-purple-900',
    change: 'text-purple-600 dark:text-purple-400'
  },
  red: {
    icon: 'text-red-500',
    bg: 'bg-red-100 dark:bg-red-900',
    change: 'text-red-600 dark:text-red-400'
  },
  yellow: {
    icon: 'text-yellow-500',
    bg: 'bg-yellow-100 dark:bg-yellow-900',
    change: 'text-yellow-600 dark:text-yellow-400'
  }
};

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  color,
  loading = false
}) => {
  const colors = colorClasses[color];

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-card rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={clsx(colors.bg, 'p-3 rounded-md animate-pulse')}>
                <div className="h-6 w-6 bg-gray-300 dark:bg-gray-600 rounded"></div>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded animate-pulse mb-2"></div>
              <div className="flex items-baseline">
                <div className="h-8 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                <div className="ml-2 h-4 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-card rounded-lg hover:shadow-card-hover transition-shadow duration-200">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={clsx(colors.bg, 'p-3 rounded-md')}>
              <Icon className={clsx('h-6 w-6', colors.icon)} />
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                {title}
              </dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {value}
                </div>
                <div className={clsx(
                  'ml-2 flex items-baseline text-sm font-semibold',
                  change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}>
                  <svg
                    className={clsx(
                      'self-center flex-shrink-0 h-4 w-4',
                      change >= 0 ? 'text-green-500' : 'text-red-500'
                    )}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    {change >= 0 ? (
                      <path
                        fillRule="evenodd"
                        d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    ) : (
                      <path
                        fillRule="evenodd"
                        d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    )}
                  </svg>
                  <span className="sr-only">
                    {change >= 0 ? 'Increased' : 'Decreased'} by
                  </span>
                  {Math.abs(change)}%
                </div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsCard; 