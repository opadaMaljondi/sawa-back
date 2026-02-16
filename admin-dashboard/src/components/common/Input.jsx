import React, { forwardRef } from 'react';
import './Input.css';

const Input = forwardRef(({
    label,
    type = 'text',
    placeholder,
    error,
    helperText,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    disabled = false,
    required = false,
    className = '',
    ...props
}, ref) => {
    const inputWrapperClasses = [
        'input-wrapper',
        fullWidth && 'input-full-width',
        error && 'input-error',
        disabled && 'input-disabled',
        icon && `input-with-icon-${iconPosition}`,
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={inputWrapperClasses}>
            {label && (
                <label className="input-label">
                    {label}
                    {required && <span className="input-required">*</span>}
                </label>
            )}
            <div className="input-container">
                {icon && iconPosition === 'left' && (
                    <span className="input-icon input-icon-left">{icon}</span>
                )}
                <input
                    ref={ref}
                    type={type}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="input-field"
                    {...props}
                />
                {icon && iconPosition === 'right' && (
                    <span className="input-icon input-icon-right">{icon}</span>
                )}
            </div>
            {error && <span className="input-error-text">{error}</span>}
            {helperText && !error && <span className="input-helper-text">{helperText}</span>}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;
