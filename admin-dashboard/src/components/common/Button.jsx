import React from 'react';
import './Button.css';

const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    icon,
    iconPosition = 'left',
    loading = false,
    disabled = false,
    fullWidth = false,
    onClick,
    type = 'button',
    className = '',
    ...props
}) => {
    const buttonClasses = [
        'btn-component',
        `btn-${variant}`,
        `btn-${size}`,
        fullWidth && 'btn-full-width',
        loading && 'btn-loading',
        className
    ].filter(Boolean).join(' ');

    return (
        <button
            type={type}
            className={buttonClasses}
            onClick={onClick}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <>
                    <span className="btn-spinner"></span>
                    <span>{children}</span>
                </>
            ) : (
                <>
                    {icon && iconPosition === 'left' && <span className="btn-icon">{icon}</span>}
                    <span>{children}</span>
                    {icon && iconPosition === 'right' && <span className="btn-icon">{icon}</span>}
                </>
            )}
        </button>
    );
};

export default Button;
