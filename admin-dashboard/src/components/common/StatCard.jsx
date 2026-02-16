import React from 'react';
import './StatCard.css';

const StatCard = ({
    title,
    value,
    icon,
    trend,
    trendValue,
    color = 'primary',
    className = ''
}) => {
    const cardClasses = [
        'stat-card',
        `stat-card-${color}`,
        className
    ].filter(Boolean).join(' ');

    const getTrendIcon = () => {
        if (!trend) return null;
        return trend === 'up' ? '↑' : '↓';
    };

    const trendClasses = [
        'stat-trend',
        trend === 'up' ? 'stat-trend-up' : 'stat-trend-down'
    ].filter(Boolean).join(' ');

    return (
        <div className={cardClasses}>
            <div className="stat-card-content">
                <div className="stat-card-info">
                    <p className="stat-card-title">{title}</p>
                    <h3 className="stat-card-value">{value}</h3>
                    {trendValue && (
                        <div className={trendClasses}>
                            <span className="stat-trend-icon">{getTrendIcon()}</span>
                            <span className="stat-trend-value">{trendValue}</span>
                        </div>
                    )}
                </div>
                {icon && (
                    <div className="stat-card-icon">
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
