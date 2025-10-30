import type {JSXElement} from "@fluentui/react-components";
import {
    Dropdown,
    makeStyles,
    Option,
    useId,
} from "@fluentui/react-components";
import type {DropdownProps} from "@fluentui/react-components";
import {viewPagesOptions} from "../store/slices/navigation.ts";
import {useNavigate} from "react-router-dom";
import {useSelector} from "react-redux";
import {selectCurrentView} from "../store/slices/navigation.ts";

const useStyles = makeStyles({
    root: {
        // Stack the label above the field with a gap
        display: "grid",
        gridTemplateRows: "repeat(1fr)",
        justifyItems: "start",
        gap: "2px",
        maxWidth: "400px",
    },
});

export const NavSelector = (props: Partial<DropdownProps>): JSXElement => {
    const styles = useStyles();
    const navigate = useNavigate();
    const dropdownId = useId("dropdown-nav-selector");
    return (
        <div className={styles.root}>
            <Dropdown id={dropdownId} placeholder="Navigate to" appearance="underline" {...props}>
                {viewPagesOptions.map(([path, label]: [string, string]) => (
                    <Option
                        key={path}
                        onSelect={() => {
                            console.log(`Navigating to /${path}`);
                            navigate(`/${path}`);
                        }}
                        value={path}
                    >
                        {label}
                    </Option>
                ))}
            </Dropdown>
        </div>
    );
}
