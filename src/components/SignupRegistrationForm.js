import React, { useLayoutEffect, useRef, useState } from 'react';
import OrganizationFields from './OrganizationFields';
import { SignupIcon } from './SignupExperience';

const steps = ['Account information', 'Organization details', 'Services and confirmation'];

// This is a presentation flow. The parent submits the same complete payload to
// the existing atomic registration endpoint only after the final step.
export default function SignupRegistrationForm({ values, onChange, onSubmit, loading, passwordRequired, error, clearError }) {
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const form = useRef(null), heading = useRef(null), previousStep = useRef(1);
  const org = values.selectedRole === 'orgadmin';
  useLayoutEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    form.current?.closest('.auth-card')?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  const go = next => { setErrors({}); clearError(); setStep(next); };
  const validate = () => {
    const next = {};
    for (const input of form.current.querySelectorAll('input, select')) {
      if (input.matches(':disabled') || !input.name || ['radio','checkbox','search'].includes(input.type)) continue;
      if (!input.validity.valid) next[input.name] = input.validity.valueMissing ? 'Please complete this field.' : input.validity.typeMismatch ? 'Enter a valid email address.' : input.validationMessage;
    }
    if (step === 1) {
      if (values.fullName.trim().length < 2) next.fullName = 'Enter your full name.';
      if ((passwordRequired || values.password) && (values.password.length < 12 || values.password.length > 128)) next.password = 'Use a password containing 12–128 characters.';
    }
    if (step === 2) {
      const details = values.organization;
      if (values.organizationName.trim().length < 2) next.organizationName = 'Enter your organization name.';
      if (details.organizationType === 'Other' && (details.organizationTypeOther || '').trim().length < 2) next.organizationTypeOther = 'Describe your organization type.';
      const phone = (details.businessPhone || '').trim();
      if (!/^\+?[\d ()-]+$/.test(phone) || phone.replace(/\D/g, '').length < 10) next.businessPhone = 'Enter a valid phone number with at least 10 digits.';
      const city = (details.businessCity || '').trim().replace(/\s+/g, ' ');
      if (city.length < 2 || city.length > 100 || city.toLowerCase() === 'other' || !/\p{L}/u.test(city) || !/^[\p{L}\p{M}\p{N} .,'’()/-]+$/u.test(city)) next.businessCity = 'Enter a valid city name.';
      if ((details.businessAddress || '').trim().length < 5) next.businessAddress = 'Enter an address with at least 5 characters.';
    }
    setErrors(next);
    if (Object.keys(next).length) {
      const first = [...form.current.querySelectorAll('input, select')].find(input => !input.matches(':disabled') && next[input.name]);
      first?.focus(); return false;
    }
    return true;
  };
  const submit = event => {
    event.preventDefault();
    if (loading || !validate()) return;
    if (org && step < 3) go(step + 1);
    else onSubmit(event);
  };
  const input = (key, label, icon, props = {}) => <div>
    <label htmlFor={`signup-${key}`}>{label}</label>
    <div className={`signup-input-wrap${key === 'password' ? ' signup-password-wrap' : ''}`}>
      <SignupIcon name={icon} />
      <input id={`signup-${key}`} name={key} value={values[key]} onChange={event => onChange(key, event.target.value)} required {...props}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={[key === 'password' && 'signup-password-help', errors[key] && `signup-${key}-error`].filter(Boolean).join(' ') || undefined} />
      {key === 'password' && <button type="button" className="signup-password-toggle" aria-label={passwordVisible ? 'Hide password' : 'Show password'} aria-controls="signup-password" aria-pressed={passwordVisible} onClick={() => setPasswordVisible(!passwordVisible)}><SignupIcon name={passwordVisible ? 'eye-off' : 'eye'} /></button>}
    </div>
    {key === 'password' && <p id="signup-password-help" className="signup-field-help">At least 12 characters.</p>}
    {errors[key] && <span id={`signup-${key}-error`} className="signup-field-error">{errors[key]}</span>}
  </div>;
  return <form ref={form} className="form signup-registration-form" noValidate onSubmit={submit} aria-describedby={error ? 'auth-error' : undefined}
    onChangeCapture={event => { const key = event.target.name; if (errors[key]) setErrors(current => { const next = { ...current }; delete next[key]; return next; }); }}>
    {org && <ol className="signup-progress" aria-label="Organization registration progress">{steps.map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={step > index + 1 ? 'is-complete' : ''}><span aria-hidden="true">{step > index + 1 ? <SignupIcon name="check" /> : index + 1}</span><span>{['Account','Organization','Review'][index]}</span></li>)}</ol>}
    <div className="signup-step-intro">
      {org && <p className="signup-step-number">Step {step} of 3</p>}
      <h3 ref={heading} tabIndex={-1}>{steps[step - 1]}</h3>
      <p>{step === 1 ? 'Start with your account. Your details stay with you as you continue.' : step === 2 ? 'Tell us about your organization so Sewak can review your application. Fields marked * are required.' : 'Choose the support you provide, then check your details before submitting for review.'}</p>
    </div>
    {Object.keys(errors).length > 0 && <p className="signup-validation-summary" role="alert">Check the highlighted fields to continue.</p>}
    <fieldset className="signup-step-fields" hidden={step !== 1} disabled={loading || step !== 1} aria-label="Account information">
      {input('fullName', 'Full name', 'user', { autoComplete: 'name', maxLength: 120, placeholder: 'Your full name' })}
      {input('email', 'Email', 'mail', { type: 'email', autoComplete: 'email', maxLength: 254, placeholder: 'your@email.com' })}
      {input('password', 'Password', 'lock', { type: passwordVisible ? 'text' : 'password', autoComplete: 'new-password', minLength: 12, maxLength: 128, required: passwordRequired, placeholder: 'At least 12 characters' })}
      <div className="signup-roles">
        <p id="registration-role-label">I want to register as</p>
        <div className="role-selection" role="group" aria-labelledby="registration-role-label">
          {[['user','Customer','Find and book trusted caregivers for your family.','home'],['orgadmin','Organization/Company','Manage your caregivers and provide care through Sewak.','organization']].map(([role,label,description,icon]) => <label key={role} className={`role-option${values.selectedRole === role ? ' signup-role--selected' : ''}`}>
            <input type="radio" name="role" value={role} checked={values.selectedRole === role} onChange={() => { onChange('selectedRole', role); setErrors({}); clearError(); }} />
            <span className="signup-role-icon"><SignupIcon name={icon} /></span><span className="signup-role-copy"><strong>{label}</strong><span>{description}</span></span><span className="signup-role-check" aria-hidden="true"><SignupIcon name="check" /></span>
          </label>)}
        </div>
        <div className="signup-role-context" aria-live="polite">{org ? 'Organization access follows application review.' : 'A helping hand for the people you love.'}</div>
      </div>
    </fieldset>
    {org && <fieldset className="signup-step-fields" hidden={step !== 2} disabled={loading || step !== 2} aria-label="Organization details">
      {input('organizationName', 'Organization/Company Name', 'organization', { autoComplete: 'organization', maxLength: 160, placeholder: 'e.g., ABC Care Services Pvt. Ltd.' })}
      <OrganizationFields value={values.organization} onChange={details => onChange('organization', details)} section="details" errors={errors} />
    </fieldset>}
    {org && step === 3 && <fieldset className="signup-step-fields" disabled={loading} aria-label="Services and confirmation">
      <OrganizationFields value={values.organization} onChange={details => onChange('organization', details)} section="services" />
      <section className="signup-review" aria-labelledby="signup-review-title">
        <h4 id="signup-review-title">Your application at a glance</h4>
        <dl><div><dt>Contact</dt><dd>{values.fullName}<br />{values.email}</dd></div><div><dt>Organization</dt><dd>{values.organizationName}<br />{values.organization.organizationType === 'Other' ? values.organization.organizationTypeOther : values.organization.organizationType}</dd></div><div><dt>Phone</dt><dd>{values.organization.businessPhone}</dd></div><div><dt>Location</dt><dd>{values.organization.businessAddress}, {values.organization.businessCity}</dd></div>
        {values.organization.businessLicense && <div><dt>Registration number</dt><dd>{values.organization.businessLicense}</dd></div>}{values.organization.panVat && <div><dt>PAN/VAT</dt><dd>{values.organization.panVat}</dd></div>}
        <div><dt>Services</dt><dd>{values.organization.servicesOffered?.length || 0} selected{!values.organization.servicesOffered?.length && ' — you can add services to your profile later.'}</dd></div></dl>
        <div className="signup-review-edit"><button type="button" onClick={() => go(1)}>Edit account</button><button type="button" onClick={() => go(2)}>Edit organization</button></div>
        <p><SignupIcon name="shield" />Your organization starts with pending approval. Sewak reviews applications before marketplace access is enabled.</p>
      </section>
    </fieldset>}
    <div className="signup-step-actions">
      {org && step > 1 && <button type="button" className="signup-back" disabled={loading} onClick={() => go(step - 1)}>Back</button>}
      <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>{loading ? 'Creating account...' : !org ? 'Sign up' : step < 3 ? 'Continue' : 'Submit application'}<span className={loading ? 'signup-spinner' : 'signup-submit-arrow'} aria-hidden="true">{!loading && <SignupIcon name="arrow" />}</span></button>
    </div>
  </form>;
}
