import { useState } from "react";
import {
  Button,
  Checkbox,
  FileInput,
  Form,
  FormGroup,
  Label,
  TextInput,
} from "@trussworks/react-uswds";

import { ResultAlert } from "../../components/feedback/ResultAlert";
import { StatusAlert } from "../../components/feedback/StatusAlert";
import { ResultTable } from "../../components/results/ResultTable";
import type { VerificationResponse } from "../../types";

interface UploadProps {
  onVerify: (image: File, claimed: Record<string, string | boolean>) => void;
  result: VerificationResponse | null;
  error: string | null;
  busy: boolean;
  onBack: () => void;
}

const TEXT_FIELDS = [
  { name: "brand_name", label: "Brand name", hint: "As written on the form" },
  { name: "class_type", label: "Class or type", hint: "For example, Straight Rye Whiskey" },
  { name: "alcohol_content", label: "Alcohol content", hint: "For example, 45% Alc./Vol." },
  { name: "net_contents", label: "Net contents", hint: "For example, 750 mL" },
] as const;

export function Upload({
  onVerify,
  result,
  error,
  busy,
  onBack,
}: UploadProps): React.ReactElement {
  const [image, setImage] = useState<File | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [warningStated, setWarningStated] = useState(true);
  const [touched, setTouched] = useState(false);

  const missing = TEXT_FIELDS.filter((field) => !(values[field.name] ?? "").trim());
  const canSubmit = image !== null && missing.length === 0 && !busy;

  return (
    <section>
      <Button type="button" unstyled onClick={onBack} className="margin-bottom-2">
        &larr; Back to the list
      </Button>

      <h2 className="font-heading-xl margin-bottom-1">Check a label that is not on the list</h2>
      <p className="font-body-lg text-base-dark margin-top-0 margin-bottom-3">
        Choose a picture of a label, type what the form says, then check it.
      </p>

      <Form
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (image === null || missing.length > 0) return;
          onVerify(image, {
            ...values,
            government_warning: warningStated,
          });
        }}
        large
      >
        <FormGroup error={touched && image === null}>
          <Label htmlFor="label-image">Picture of the label</Label>
          <span id="label-image-hint" className="usa-hint">
            A JPEG, PNG, or WebP file up to 20 MB.
          </span>
          {touched && image === null && (
            <span className="usa-error-message" role="alert">
              Choose a picture before checking.
            </span>
          )}
          <FileInput
            id="label-image"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            aria-describedby="label-image-hint"
            onChange={(event) => {
              setImage(event.target.files?.[0] ?? null);
            }}
          />
        </FormGroup>

        {TEXT_FIELDS.map((field) => {
          const invalid = touched && !(values[field.name] ?? "").trim();
          return (
            <FormGroup key={field.name} error={invalid}>
              <Label htmlFor={field.name}>{field.label}</Label>
              <span id={`${field.name}-hint`} className="usa-hint">
                {field.hint}
              </span>
              {invalid && (
                <span className="usa-error-message" role="alert">
                  Type what the form says for {field.label.toLowerCase()}.
                </span>
              )}
              <TextInput
                id={field.name}
                name={field.name}
                type="text"
                aria-describedby={`${field.name}-hint`}
                value={values[field.name] ?? ""}
                onChange={(event) => {
                  setValues({ ...values, [field.name]: event.target.value });
                }}
              />
            </FormGroup>
          );
        })}

        <FormGroup>
          <Checkbox
            id="government_warning"
            name="government_warning"
            label="The form says the government warning is on the label"
            checked={warningStated}
            onChange={(event) => {
              setWarningStated(event.target.checked);
            }}
          />
        </FormGroup>

        <Button type="submit" size="big" disabled={!canSubmit}>
          {busy ? "Checking…" : "Check this label"}
        </Button>
      </Form>

      <div aria-live="polite" aria-atomic="true" className="margin-top-3">
        {error !== null && (
          <StatusAlert type="error" heading="Could not check this label">
            {error}
          </StatusAlert>
        )}
        {result && (
          <>
            <ResultAlert result={result} />
            <ResultTable
              fields={result.fields}
              claimedHeading="What you typed"
              caption="Comparison of typed and printed values"
            />
          </>
        )}
      </div>
    </section>
  );
}
