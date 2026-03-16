import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Text,
  Label,
  Radio,
  RadioGroup,
  Checkbox,
  Input,
  makeStyles,
  tokens,
  Divider,
} from '@fluentui/react-components'
import { useState } from 'react'
import type { CsvConfig } from '../types/content'

const PRESET_DELIMITERS = [
  { label: 'Comma  ( , )', value: ',' },
  { label: 'Semicolon  ( ; )', value: ';' },
  { label: 'Tab  ( \\t )', value: '\t' },
  { label: 'Pipe  ( | )', value: '|' },
  { label: 'Custom', value: '__custom__' },
]

interface CsvConfigDialogProps {
  open: boolean
  onConfirm: (config: CsvConfig) => void
  onCancel: () => void
}

const useStyles = makeStyles({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    minWidth: 'min(420px, 90vw)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  sectionLabel: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  radioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  customInput: {
    maxWidth: '120px',
  },
  hint: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  infoBox: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalM,
  },
})

export const CsvConfigDialog = ({ open, onConfirm, onCancel }: CsvConfigDialogProps) => {
  const styles = useStyles()
  const [delimiterOption, setDelimiterOption] = useState(',')
  const [customDelimiter, setCustomDelimiter] = useState('')
  const [hasHeader, setHasHeader] = useState(true)
  const [quoteChar, setQuoteChar] = useState('"')

  const effectiveDelimiter =
    delimiterOption === '__custom__' ? customDelimiter : delimiterOption

  const canConfirm = effectiveDelimiter.length === 1

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm({
      delimiter: effectiveDelimiter,
      hasHeader,
      quoteChar: quoteChar || '"',
    })
  }

  return (
    <Dialog open={open} onOpenChange={(_, data) => { if (!data.open) onCancel() }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Configure CSV Import</DialogTitle>
          <DialogContent className={styles.content}>
            <div className={styles.infoBox}>
              <Text className={styles.hint}>
                Select how your CSV file is structured so it can be read and validated correctly.
              </Text>
            </div>

            <div className={styles.section}>
              <Text className={styles.sectionLabel}>Column Delimiter</Text>
              <RadioGroup
                className={styles.radioGroup}
                value={delimiterOption}
                onChange={(_, data) => setDelimiterOption(data.value)}
              >
                {PRESET_DELIMITERS.map((d) => (
                  <Radio key={d.value} value={d.value} label={d.label} />
                ))}
              </RadioGroup>
              {delimiterOption === '__custom__' && (
                <div>
                  <Label htmlFor="csv-custom-delimiter">Custom delimiter character</Label>
                  <Input
                    id="csv-custom-delimiter"
                    className={styles.customInput}
                    maxLength={1}
                    value={customDelimiter}
                    onChange={(_, data) => setCustomDelimiter(data.value)}
                    placeholder="e.g. :"
                  />
                  {customDelimiter.length !== 1 && (
                    <Text className={styles.hint}>Enter exactly one character.</Text>
                  )}
                </div>
              )}
            </div>

            <Divider />

            <div className={styles.section}>
              <Text className={styles.sectionLabel}>Header Row</Text>
              <Checkbox
                label="First row contains column headers"
                checked={hasHeader}
                onChange={(_, data) => setHasHeader(Boolean(data.checked))}
              />
            </div>

            <Divider />

            <div className={styles.section}>
              <Text className={styles.sectionLabel}>Quote Character</Text>
              <RadioGroup
                className={styles.radioGroup}
                value={quoteChar}
                onChange={(_, data) => setQuoteChar(data.value)}
              >
                <Radio value={'"'} label={'Double quote  ( " )'} />
                <Radio value={"'"} label={"Single quote  ( ' )"} />
                <Radio value={''} label={'None'} />
              </RadioGroup>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button appearance="primary" onClick={handleConfirm} disabled={!canConfirm}>
              Select File
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

export default CsvConfigDialog
