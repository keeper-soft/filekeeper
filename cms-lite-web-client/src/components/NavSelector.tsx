import type {JSXElement, OptionOnSelectData, SelectionEvents} from "@fluentui/react-components";
import {
    Dropdown,
    makeStyles,
    Option,
    useId,
} from "@fluentui/react-components";
import type {DropdownProps} from "@fluentui/react-components";
import {selectCurrentView, viewPagesOptions, matchPathToView} from "../store/slices/navigation.ts";
import {useNavigate} from "react-router-dom";
import {useSelector} from "react-redux";

const useStyles = makeStyles({
    root: {
        // Stack the label above the field with a gap
        display: "grid",
        gridTemplateRows: "repeat(1fr)",
        justifyItems: "start",
        gap: "2px",
        maxWidth: "400px",
    },
    selector: {
        "& button": {
            paddingBottom: "11px"
        }
    }
});

export const NavSelector = (props: Partial<DropdownProps>): JSXElement => {
    const styles = useStyles();
    const navigate = useNavigate();
    const dropdownId = useId("dropdown-nav-selector");
    const currentView = useSelector(selectCurrentView);
    const handleOptionSelect = (event: SelectionEvents, data: OptionOnSelectData) => {
        event.preventDefault();
        const value: string | undefined = data.optionValue
        if (!value) {
            return
        }
        const destination = matchPathToView(value) ?? value
        if (destination.startsWith('/')) {
            navigate(destination)
            return
        }
        //TODO: Manage this case better than this
        alert("This page is not yet implemented");
    }
    return (
        <div className={styles.root}>
            <Dropdown className={styles.selector} id={dropdownId} placeholder="Navigate to"
                      appearance="underline" {...props} onOptionSelect={handleOptionSelect}>
                {viewPagesOptions.map(([path, label]: [string, string]) => (
                    <Option
                        key={path}
                        value={path}
                        disabled={path === currentView}
                    >
                        {label}
                    </Option>
                ))}
            </Dropdown>
        </div>
    );
}
